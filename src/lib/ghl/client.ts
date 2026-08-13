import type {
  Contact,
  DateRange,
  Invoice,
  Product,
  SourceCompleteness,
  Subscription,
  Transaction
} from "@/lib/reconcile/types";

export const HIGHLEVEL_API_BASE = "https://services.leadconnectorhq.com";
const CRM_API_VERSION = "2023-02-21";
const COMMERCE_API_VERSION = "2021-07-28";

type QueryValue = string | number | boolean | null | undefined;
type RawRecord = Record<string, unknown>;
const PAGE_LIMIT = 100;
const MAX_PAGES = 1_000;

export type SourceRead<T> = {
  records: T[];
  completeness: SourceCompleteness;
};

export class HighLevelRequestError extends Error {
  constructor(
    readonly path: string,
    readonly status: number
  ) {
    super(`HighLevel request failed for ${path}: ${status}`);
    this.name = "HighLevelRequestError";
  }
}

type RawPage = {
  records: RawRecord[];
  reportedTotal?: number;
};

export function buildGhlUrl(path: string, query: Record<string, QueryValue> = {}): URL {
  const url = new URL(path.startsWith("/") ? path : `/${path}`, HIGHLEVEL_API_BASE);

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  return url;
}

export class HighLevelClient {
  constructor(
    private readonly accessToken: string,
    private readonly fetcher: typeof fetch = fetch
  ) {}

  async listInvoices(locationId: string, dateRange: DateRange): Promise<Invoice[]> {
    return (await this.readInvoices(locationId, dateRange)).records;
  }

  async readInvoices(locationId: string, dateRange: DateRange): Promise<SourceRead<Invoice>> {
    const result = await this.getOffsetPaginatedList("/invoices/", {
      altId: locationId,
      altType: "location",
      startAt: dateRange.from,
      endAt: dateRange.to,
      limit: PAGE_LIMIT
    });
    return mapSourceRead(result, normalizeInvoice);
  }

  async listTransactions(locationId: string, dateRange: DateRange): Promise<Transaction[]> {
    return (await this.readTransactions(locationId, dateRange)).records;
  }

  async readTransactions(locationId: string, dateRange: DateRange): Promise<SourceRead<Transaction>> {
    const result = await this.getOffsetPaginatedList("/payments/transactions", {
      altId: locationId,
      altType: "location",
      startAt: dateRange.from,
      endAt: dateRange.to,
      limit: PAGE_LIMIT
    });
    return mapSourceRead(result, normalizeTransaction);
  }

  async listSubscriptions(locationId: string): Promise<Subscription[]> {
    return (await this.readSubscriptions(locationId)).records;
  }

  async readSubscriptions(locationId: string): Promise<SourceRead<Subscription>> {
    const result = await this.getOffsetPaginatedList("/payments/subscriptions", {
      altId: locationId,
      altType: "location",
      limit: PAGE_LIMIT
    });
    return mapSourceRead(result, normalizeSubscription);
  }

  async listContacts(locationId: string): Promise<Contact[]> {
    return (await this.readContacts(locationId)).records;
  }

  async readContacts(locationId: string): Promise<SourceRead<Contact>> {
    const result = await this.getCursorPaginatedList("/contacts/", { locationId, limit: PAGE_LIMIT });
    return mapSourceRead(result, normalizeContact);
  }

  async listProducts(locationId: string): Promise<Product[]> {
    return (await this.readProducts(locationId)).records;
  }

  async readProducts(locationId: string): Promise<SourceRead<Product>> {
    const result = await this.getOffsetPaginatedList("/products/", { locationId, limit: PAGE_LIMIT });
    return mapSourceRead(result, normalizeProduct);
  }

  private async getOffsetPaginatedList(path: string, query: Record<string, QueryValue>): Promise<SourceRead<RawRecord>> {
    const limit = Number(query.limit ?? PAGE_LIMIT);
    const records: RawRecord[] = [];
    let offset = 0;
    let pagesRead = 0;
    let reportedTotal: number | undefined;
    let previousSignature: string | undefined;

    while (pagesRead < MAX_PAGES) {
      let page: RawPage;
      try {
        page = await this.getPage(path, { ...query, offset });
      } catch (error) {
        if (records.length === 0) {
          throw error;
        }
        return partialSource(records, pagesRead, reportedTotal, `HighLevel stopped responding after page ${pagesRead}; this source is partial.`);
      }

      const signature = pageSignature(page.records);
      if (page.records.length > 0 && signature === previousSignature) {
        return partialSource(records, pagesRead, reportedTotal, "HighLevel repeated a pagination page; this source is partial.");
      }

      pagesRead += 1;
      records.push(...page.records);
      reportedTotal = page.reportedTotal ?? reportedTotal;
      previousSignature = signature;

      if ((reportedTotal !== undefined && records.length >= reportedTotal) || page.records.length < limit) {
        return completeSource(records, pagesRead, reportedTotal);
      }

      offset += limit;
    }

    return partialSource(records, pagesRead, reportedTotal, `HighLevel pagination exceeded ${MAX_PAGES} pages; this source is partial.`);
  }

  private async getCursorPaginatedList(path: string, query: Record<string, QueryValue>): Promise<SourceRead<RawRecord>> {
    const limit = Number(query.limit ?? PAGE_LIMIT);
    const records: RawRecord[] = [];
    let pagesRead = 0;
    let reportedTotal: number | undefined;
    let startAfterId: string | undefined;

    while (pagesRead < MAX_PAGES) {
      let page: RawPage;
      try {
        page = await this.getPage(path, { ...query, startAfterId });
      } catch (error) {
        if (records.length === 0) {
          throw error;
        }
        return partialSource(records, pagesRead, reportedTotal, `HighLevel stopped responding after page ${pagesRead}; this source is partial.`);
      }

      pagesRead += 1;
      records.push(...page.records);
      reportedTotal = page.reportedTotal ?? reportedTotal;

      if ((reportedTotal !== undefined && records.length >= reportedTotal) || page.records.length < limit) {
        return completeSource(records, pagesRead, reportedTotal);
      }

      const nextStartAfterId = asString(page.records.at(-1)?.id ?? page.records.at(-1)?._id);
      if (!nextStartAfterId || nextStartAfterId === startAfterId) {
        return partialSource(records, pagesRead, reportedTotal, "HighLevel did not provide a new contact cursor; this source is partial.");
      }
      startAfterId = nextStartAfterId;
    }

    return partialSource(records, pagesRead, reportedTotal, `HighLevel pagination exceeded ${MAX_PAGES} pages; this source is partial.`);
  }

  private async getPage(path: string, query: Record<string, QueryValue>): Promise<RawPage> {
    const response = await this.fetcher(buildGhlUrl(path, query), {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.accessToken}`,
        Version: apiVersionForPath(path)
      }
    });

    if (!response.ok) {
      console.warn("HighLevel source request rejected", { path, status: response.status });
      throw new HighLevelRequestError(path, response.status);
    }

    const payload = (await response.json()) as unknown;
    return { records: extractRecords(payload), reportedTotal: extractReportedTotal(payload) };
  }
}

function apiVersionForPath(path: string): string {
  return path.startsWith("/payments/") || path.startsWith("/products/")
    ? COMMERCE_API_VERSION
    : CRM_API_VERSION;
}

export function normalizeInvoice(raw: RawRecord): Invoice {
  const contactDetails = isRecord(raw.contactDetails) ? raw.contactDetails : undefined;
  const transactionIds = arrayOfStrings(raw.transactionIds ?? raw.transactions);
  const singleTransactionId = asString(raw.transactionId ?? raw.paymentTransactionId);

  return {
    id: requiredId(raw),
    number: asString(raw.invoiceNumber ?? raw.number),
    contactId: asString(raw.contactId ?? raw.customerId ?? contactDetails?.id),
    status: asString(raw.status) ?? "unknown",
    totalCents: normalizeMoney(raw.total ?? raw.amount ?? raw.totalAmount ?? raw.amountDue),
    amountPaidCents: maybeMoney(raw.amountPaid),
    balanceCents: maybeMoney(raw.balance ?? raw.balanceDue ?? raw.amountDue),
    currency: normalizeCurrency(raw.currency),
    transactionIds: singleTransactionId ? [...transactionIds, singleTransactionId] : transactionIds,
    providerChargeId: asString(raw.providerChargeId ?? raw.stripeChargeId ?? raw.chargeId),
    orderId: asString(raw.orderId),
    paidAt: asString(raw.paidAt ?? raw.paymentDate),
    createdAt: asString(raw.createdAt ?? raw.dateAdded ?? raw.issueDate) ?? new Date(0).toISOString()
  };
}

export function normalizeTransaction(raw: RawRecord): Transaction {
  return {
    id: requiredId(raw),
    invoiceId: asString(raw.invoiceId ?? raw.entityId),
    orderId: asString(raw.orderId),
    contactId: asString(raw.contactId ?? raw.customerId),
    subscriptionId: asString(raw.subscriptionId),
    providerChargeId: asString(raw.providerChargeId ?? raw.stripeChargeId ?? raw.chargeId ?? raw.paymentIntentId),
    status: asString(raw.status ?? raw.transactionStatus) ?? "unknown",
    amountCents: normalizeMoney(raw.amount ?? raw.total ?? raw.amountCaptured),
    currency: normalizeCurrency(raw.currency),
    createdAt: asString(raw.createdAt ?? raw.dateAdded ?? raw.transactionDate) ?? new Date(0).toISOString()
  };
}

export function normalizeSubscription(raw: RawRecord): Subscription {
  return {
    id: requiredId(raw),
    contactId: asString(raw.contactId ?? raw.customerId),
    status: asString(raw.status) ?? "unknown",
    latestPaymentStatus: asString(raw.latestPaymentStatus ?? raw.paymentStatus),
    latestTransactionId: asString(raw.latestTransactionId ?? raw.transactionId),
    amountCents: maybeMoney(raw.amount ?? raw.recurringAmount),
    currency: normalizeCurrency(raw.currency),
    serviceLabel: asString(raw.productName ?? raw.name ?? raw.planName)
  };
}

function normalizeProduct(raw: RawRecord): Product {
  return {
    id: requiredId(raw),
    name: asString(raw.name ?? raw.title)
  };
}

function normalizeContact(raw: RawRecord): Contact {
  return {
    id: requiredId(raw),
    name: asString(raw.name ?? raw.fullName ?? raw.contactName),
    email: asString(raw.email)
  };
}

function extractRecords(payload: unknown): RawRecord[] {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord);
  }

  if (!isRecord(payload)) {
    return [];
  }

  for (const key of ["data", "items", "invoices", "transactions", "subscriptions", "contacts", "products"]) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value.filter(isRecord);
    }
  }

  return [];
}

function extractReportedTotal(payload: unknown): number | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }
  for (const key of ["totalCount", "count", "total"]) {
    const value = payload[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      return value;
    }
  }
  return undefined;
}

function mapSourceRead<T>(source: SourceRead<RawRecord>, normalize: (record: RawRecord) => T): SourceRead<T> {
  return { records: source.records.map(normalize), completeness: source.completeness };
}

function completeSource(records: RawRecord[], pagesRead: number, reportedTotal?: number): SourceRead<RawRecord> {
  return { records, completeness: { complete: true, pagesRead, reportedTotal, warning: undefined } };
}

function partialSource(
  records: RawRecord[],
  pagesRead: number,
  reportedTotal: number | undefined,
  warning: string
): SourceRead<RawRecord> {
  return { records, completeness: { complete: false, pagesRead, reportedTotal, warning } };
}

function pageSignature(records: RawRecord[]): string {
  return records.map((record) => asString(record.id ?? record._id) ?? "missing-id").join("|");
}

function requiredId(raw: RawRecord): string {
  const id = asString(raw.id ?? raw._id);
  if (!id) {
    throw new Error("HighLevel record is missing an id.");
  }
  return id;
}

function normalizeMoney(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Number.isInteger(value) && Math.abs(value) >= 1000 ? value : Math.round(value * 100);
  }

  if (typeof value === "string" && value.trim() !== "") {
    return normalizeMoney(Number(value));
  }

  return 0;
}

function maybeMoney(value: unknown): number | undefined {
  return value === undefined || value === null ? undefined : normalizeMoney(value);
}

function normalizeCurrency(value: unknown): string {
  return asString(value)?.toUpperCase() ?? "USD";
}

function asString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return undefined;
}

function arrayOfStrings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string" && item.trim() !== "");
}

function isRecord(value: unknown): value is RawRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
