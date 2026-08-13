import { HighLevelClient } from "@/lib/ghl/client";
import { demoPayMatchInput } from "@/lib/reconcile/fixtures";
import { toPayMatchCsv } from "@/lib/reconcile/export";
import { reconcilePayMatch } from "@/lib/reconcile/matcher";
import type {
  Contact,
  DateRange,
  Invoice,
  Product,
  ReconcileResult,
  SourceCompleteness,
  Subscription,
  Transaction
} from "@/lib/reconcile/types";
import type { SourceRead } from "@/lib/ghl/client";
import { getInstallationStore, type InstallationStore } from "@/lib/store/installations";
import type { PayMatchInstallation } from "@/lib/store/installations";
import { getValidInstallation } from "@/lib/ghl/session";
import { recordAppEvent, type AppEvent } from "@/lib/observability/events";
import {
  releasePayMatchScan,
  reservePayMatchScan,
  type ScanReservation
} from "@/lib/billing/entitlements";

export type PayMatchScanParams = {
  from?: string;
  to?: string;
  locationId?: string;
  installationId?: string;
};

export type PayMatchScan = {
  mode: "fixture" | "live";
  locationId: string;
  result: ReconcileResult;
  csv: {
    paidWithoutCharge: string;
    chargeWithoutInvoice: string;
    activeSubFailedPayment: string;
    amountCurrencyMismatch: string;
  };
};

type PayMatchClient = {
  listInvoices(locationId: string, dateRange: DateRange): Promise<Invoice[]>;
  listTransactions(locationId: string, dateRange: DateRange): Promise<Transaction[]>;
  listSubscriptions(locationId: string): Promise<Subscription[]>;
  listContacts(locationId: string): Promise<Contact[]>;
  readInvoices?(locationId: string, dateRange: DateRange): Promise<SourceRead<Invoice>>;
  readTransactions?(locationId: string, dateRange: DateRange): Promise<SourceRead<Transaction>>;
  readSubscriptions?(locationId: string): Promise<SourceRead<Subscription>>;
  readContacts?(locationId: string): Promise<SourceRead<Contact>>;
  readProducts?(locationId: string): Promise<SourceRead<Product>>;
};

type ScanDependencies = {
  store?: InstallationStore;
  clientFactory?: (accessToken: string) => PayMatchClient;
  getInstallation?: (id: string, store: InstallationStore) => Promise<PayMatchInstallation>;
  recordEvent?: (event: AppEvent) => Promise<void>;
  reserveScan?: (installationId: string) => Promise<ScanReservation>;
  releaseScan?: (installationId: string) => Promise<void>;
};

export class ScanLimitExceededError extends Error {
  constructor() {
    super("The free scan has already been used. Upgrade in HighLevel Marketplace to run another live scan.");
    this.name = "ScanLimitExceededError";
  }
}

export async function scanPayMatch(params: PayMatchScanParams = {}, deps: ScanDependencies = {}): Promise<PayMatchScan> {
  const dateRange = {
    from: params.from ?? demoPayMatchInput.dateRange.from,
    to: params.to ?? demoPayMatchInput.dateRange.to
  };
  const fallbackLocationId = params.locationId ?? "demo-location";

  if (!params.installationId) {
    return buildScan("fixture", fallbackLocationId, reconcilePayMatch({ ...demoPayMatchInput, dateRange }));
  }

  const store = deps.store ?? getInstallationStore();
  const startedAt = Date.now();
  const recordEvent = deps.recordEvent ?? recordAppEvent;
  await safeRecordEvent(recordEvent, {
    installationId: params.installationId,
    name: "scan_started",
    result: "success"
  });

  let consumedFreeScan = false;
  try {
    const reservation = await (deps.reserveScan ?? reservePayMatchScan)(params.installationId);
    if (!reservation.allowed) {
      throw new ScanLimitExceededError();
    }
    consumedFreeScan = reservation.consumedFreeScan;

    const getInstallation = deps.getInstallation ?? ((id, installationStore) => getValidInstallation(id, { store: installationStore }));
    const installation = await getInstallation(params.installationId, store);

    const clientFactory = deps.clientFactory ?? ((accessToken: string) => new HighLevelClient(accessToken));
    const client = clientFactory(installation.accessToken);
    const locationId = installation.locationId ?? fallbackLocationId;
    const [invoiceSource, transactionSource, subscriptionSource, contactSource, productSource] = await Promise.all([
      client.readInvoices?.(locationId, dateRange) ?? completeRead(client.listInvoices(locationId, dateRange)),
      client.readTransactions?.(locationId, dateRange) ?? completeRead(client.listTransactions(locationId, dateRange)),
      client.readSubscriptions?.(locationId) ?? completeRead(client.listSubscriptions(locationId)),
      client.readContacts?.(locationId) ?? completeRead(client.listContacts(locationId)),
      client.readProducts?.(locationId) ?? completeRead(Promise.resolve([] as Product[]))
    ]);

    const scan = buildScan(
      "live",
      locationId,
      reconcilePayMatch({
        dateRange,
        invoices: invoiceSource.records,
        transactions: transactionSource.records,
        subscriptions: subscriptionSource.records,
        contacts: contactSource.records,
        products: productSource.records,
        sourceCompleteness: {
          invoices: invoiceSource.completeness,
          transactions: transactionSource.completeness,
          subscriptions: subscriptionSource.completeness,
          contacts: contactSource.completeness,
          products: productSource.completeness
        }
      })
    );
    await safeRecordEvent(recordEvent, {
      installationId: params.installationId,
      name: "scan_completed",
      result: "success",
      durationMs: Date.now() - startedAt
    });
    return scan;
  } catch (error) {
    if (consumedFreeScan) {
      await safeReleaseScan(deps.releaseScan ?? releasePayMatchScan, params.installationId);
    }
    await safeRecordEvent(recordEvent, {
      installationId: params.installationId,
      name: "scan_failed",
      result: "failure",
      durationMs: Date.now() - startedAt,
      errorCode: error instanceof Error ? error.name : "unknown_error"
    });
    throw error;
  }
}

async function completeRead<T>(recordsPromise: Promise<T[]>): Promise<SourceRead<T>> {
  const records = await recordsPromise;
  const completeness: SourceCompleteness = {
    complete: true,
    pagesRead: records.length > 0 ? 1 : 0,
    reportedTotal: records.length
  };
  return { records, completeness };
}

async function safeReleaseScan(release: (installationId: string) => Promise<void>, installationId: string): Promise<void> {
  try {
    await release(installationId);
  } catch {
    // The original scan error is more actionable than a best-effort reservation rollback failure.
  }
}

async function safeRecordEvent(recorder: (event: AppEvent) => Promise<void>, event: AppEvent): Promise<void> {
  try {
    await recorder(event);
  } catch {
    // Reconciliation should not fail solely because telemetry storage is unavailable.
  }
}

function buildScan(mode: PayMatchScan["mode"], locationId: string, result: ReconcileResult): PayMatchScan {
  return {
    mode,
    locationId,
    result,
    csv: {
      paidWithoutCharge: toPayMatchCsv("paidWithoutCharge", result.tables.paidWithoutCharge),
      chargeWithoutInvoice: toPayMatchCsv("chargeWithoutInvoice", result.tables.chargeWithoutInvoice),
      activeSubFailedPayment: toPayMatchCsv("activeSubFailedPayment", result.tables.activeSubFailedPayment),
      amountCurrencyMismatch: toPayMatchCsv("amountCurrencyMismatch", result.tables.amountCurrencyMismatch)
    }
  };
}
