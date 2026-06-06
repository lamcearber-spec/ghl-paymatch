import type { Contact, DateRange, Invoice, Subscription, Transaction } from "@/lib/reconcile/types";

export const HIGHLEVEL_API_BASE = "https://services.leadconnectorhq.com";
const HIGHLEVEL_API_VERSION = "2023-02-21";

type QueryValue = string | number | boolean | null | undefined;
type RawRecord = Record<string, unknown>;
const PAGE_LIMIT = 100;

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
    const records = await this.getPaginatedList("/invoices/", {
      altId: locationId,
      altType: "location",
      startAt: dateRange.from,
      endAt: dateRange.to,
      limit: PAGE_LIMIT
    });
    return records.map(normalizeInvoice);
  }

  async listTransactions(locationId: string, dateRange: DateRange): Promise<Transaction[]> {
    const records = await this.getPaginatedList("/payments/transactions", {
      altId: locationId,
      altType: "location",
      startAt: dateRange.from,
      endAt: dateRange.to,
      limit: PAGE_LIMIT
    });
    return records.map(normalizeTransaction);
  }

  async listSubscriptions(locationId: string): Promise<Subscription[]> {
    const records = await this.getPaginatedList("/payments/subscriptions", {
      altId: locationId,
      altType: "location",
      limit: PAGE_LIMIT
    });
    return records.map(normalizeSubscription);
  }

  async listContacts(locationId: string): Promise<Contact[]> {
    const records = await this.getList("/contacts/", {
      locationId,
      limit: 100
    });
    return records.map(normalizeContact);
  }

  private async getPaginatedList(path: string, query: Record<string, QueryValue>): Promise<RawRecord[]> {
    const limit = Number(query.limit ?? PAGE_LIMIT);
    const records: RawRecord[] = [];
    let offset = 0;

    while (true) {
      const page = await this.getList(path, { ...query, offset });
      records.push(...page);

      if (page.length < limit) {
        return records;
      }

      offset += limit;
    }
  }

  private async getList(path: string, query: Record<string, QueryValue>): Promise<RawRecord[]> {
    const response = await this.fetcher(buildGhlUrl(path, query), {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.accessToken}`,
        Version: HIGHLEVEL_API_VERSION
      }
    });

    if (!response.ok) {
      throw new Error(`HighLevel request failed: ${response.status}`);
    }

    const payload = (await response.json()) as unknown;
    return extractRecords(payload);
  }
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

  for (const key of ["data", "items", "invoices", "transactions", "subscriptions", "contacts"]) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value.filter(isRecord);
    }
  }

  return [];
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
