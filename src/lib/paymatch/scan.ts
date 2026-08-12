import { HighLevelClient } from "@/lib/ghl/client";
import { demoPayMatchInput } from "@/lib/reconcile/fixtures";
import { toCsv } from "@/lib/reconcile/export";
import { reconcilePayMatch } from "@/lib/reconcile/matcher";
import type { Contact, DateRange, Invoice, ReconcileResult, Subscription, Transaction } from "@/lib/reconcile/types";
import { getInstallationStore, type InstallationStore } from "@/lib/store/installations";
import type { PayMatchInstallation } from "@/lib/store/installations";
import { getValidInstallation } from "@/lib/ghl/session";
import { recordAppEvent, type AppEvent } from "@/lib/observability/events";

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
};

type ScanDependencies = {
  store?: InstallationStore;
  clientFactory?: (accessToken: string) => PayMatchClient;
  getInstallation?: (id: string, store: InstallationStore) => Promise<PayMatchInstallation>;
  recordEvent?: (event: AppEvent) => Promise<void>;
};

export async function scanPayMatch(params: PayMatchScanParams = {}, deps: ScanDependencies = {}): Promise<PayMatchScan> {
  const dateRange = {
    from: params.from ?? demoPayMatchInput.dateRange.from,
    to: params.to ?? demoPayMatchInput.dateRange.to
  };
  const fallbackLocationId = params.locationId ?? "demo-location";
  const store = deps.store ?? getInstallationStore();

  if (!params.installationId) {
    return buildScan("fixture", fallbackLocationId, reconcilePayMatch({ ...demoPayMatchInput, dateRange }));
  }

  const startedAt = Date.now();
  const recordEvent = deps.recordEvent ?? recordAppEvent;
  await safeRecordEvent(recordEvent, {
    installationId: params.installationId,
    name: "scan_started",
    result: "success"
  });

  try {
    const getInstallation = deps.getInstallation ?? ((id, installationStore) => getValidInstallation(id, { store: installationStore }));
    const installation = await getInstallation(params.installationId, store);

    const clientFactory = deps.clientFactory ?? ((accessToken: string) => new HighLevelClient(accessToken));
    const client = clientFactory(installation.accessToken);
    const locationId = installation.locationId ?? fallbackLocationId;
    const [invoices, transactions, subscriptions, contacts] = await Promise.all([
      client.listInvoices(locationId, dateRange),
      client.listTransactions(locationId, dateRange),
      client.listSubscriptions(locationId),
      client.listContacts(locationId)
    ]);

    const scan = buildScan("live", locationId, reconcilePayMatch({ dateRange, invoices, transactions, subscriptions, contacts }));
    await safeRecordEvent(recordEvent, {
      installationId: params.installationId,
      name: "scan_completed",
      result: "success",
      durationMs: Date.now() - startedAt
    });
    return scan;
  } catch (error) {
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
      paidWithoutCharge: toCsv(result.tables.paidWithoutCharge),
      chargeWithoutInvoice: toCsv(result.tables.chargeWithoutInvoice),
      activeSubFailedPayment: toCsv(result.tables.activeSubFailedPayment),
      amountCurrencyMismatch: toCsv(result.tables.amountCurrencyMismatch)
    }
  };
}
