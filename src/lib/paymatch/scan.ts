import { HighLevelClient } from "@/lib/ghl/client";
import { demoPayMatchInput } from "@/lib/reconcile/fixtures";
import { toCsv } from "@/lib/reconcile/export";
import { reconcilePayMatch } from "@/lib/reconcile/matcher";
import type { Contact, DateRange, Invoice, ReconcileResult, Subscription, Transaction } from "@/lib/reconcile/types";
import { getInstallationStore, type InstallationStore } from "@/lib/store/installations";

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
};

export async function scanPayMatch(params: PayMatchScanParams = {}, deps: ScanDependencies = {}): Promise<PayMatchScan> {
  const dateRange = {
    from: params.from ?? demoPayMatchInput.dateRange.from,
    to: params.to ?? demoPayMatchInput.dateRange.to
  };
  const fallbackLocationId = params.locationId ?? "demo-location";
  const store = deps.store ?? getInstallationStore();
  const installation = params.installationId ? await store.get(params.installationId) : undefined;

  if (!installation) {
    return buildScan("fixture", fallbackLocationId, reconcilePayMatch({ ...demoPayMatchInput, dateRange }));
  }

  const clientFactory = deps.clientFactory ?? ((accessToken: string) => new HighLevelClient(accessToken));
  const client = clientFactory(installation.accessToken);
  const locationId = installation.locationId ?? fallbackLocationId;
  const [invoices, transactions, subscriptions, contacts] = await Promise.all([
    client.listInvoices(locationId, dateRange),
    client.listTransactions(locationId, dateRange),
    client.listSubscriptions(locationId),
    client.listContacts(locationId)
  ]);

  return buildScan("live", locationId, reconcilePayMatch({ dateRange, invoices, transactions, subscriptions, contacts }));
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
