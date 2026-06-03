import type {
  ActiveSubFailedPaymentRow,
  ChargeWithoutInvoiceRow,
  Contact,
  Invoice,
  PaidWithoutChargeRow,
  ReconcileInput,
  ReconcileResult,
  Subscription,
  Transaction
} from "./types";

const FUZZY_DATE_WINDOW_DAYS = 7;
const PAID_INVOICE_STATUSES = new Set(["paid", "closed", "complete", "completed", "succeeded"]);
const CAPTURED_TRANSACTION_STATUSES = new Set(["captured", "succeeded", "success", "paid", "complete", "completed"]);
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);
const FAILED_PAYMENT_STATUSES = new Set(["failed", "past_due", "declined", "unpaid", "requires_payment_method"]);

export function reconcilePayMatch(input: ReconcileInput): ReconcileResult {
  const contacts = new Map(input.contacts.map((contact) => [contact.id, contact]));
  const capturedTransactions = input.transactions.filter(isCapturedTransaction);
  const exactMatches = buildExactMatches(input.invoices, capturedTransactions);
  const paidWithoutCharge: PaidWithoutChargeRow[] = [];
  const chargeWithoutInvoice: ChargeWithoutInvoiceRow[] = [];
  const activeSubFailedPayment = input.subscriptions
    .filter(hasActiveFailedPayment)
    .map((subscription) => subscriptionRiskRow(subscription, contacts));
  const amountCurrencyMismatch = Array.from(exactMatches.entries())
    .filter(([invoice, transaction]) => invoice.totalCents !== transaction.amountCents || invoice.currency !== transaction.currency)
    .map(([invoice, transaction]) => ({
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      transactionId: transaction.id,
      providerChargeId: transaction.providerChargeId,
      customerName: contactName(contacts, invoice.contactId),
      invoiceAmountCents: invoice.totalCents,
      transactionAmountCents: transaction.amountCents,
      invoiceCurrency: invoice.currency,
      transactionCurrency: transaction.currency,
      reason: "Linked invoice and captured transaction do not agree on amount or currency."
    }));

  const exactInvoiceIds = new Set(Array.from(exactMatches.keys()).map((invoice) => invoice.id));
  const exactTransactionIds = new Set(Array.from(exactMatches.values()).map((transaction) => transaction.id));
  const reviewInvoiceToTransaction = new Map<string, Transaction>();
  const reviewTransactionToInvoice = new Map<string, Invoice>();

  for (const invoice of input.invoices.filter(isPaidInvoice)) {
    if (exactInvoiceIds.has(invoice.id)) {
      continue;
    }

    const candidate = findFuzzyTransaction(invoice, capturedTransactions, exactTransactionIds);
    if (candidate) {
      reviewInvoiceToTransaction.set(invoice.id, candidate);
      reviewTransactionToInvoice.set(candidate.id, invoice);
      paidWithoutCharge.push({
        invoiceId: invoice.id,
        invoiceNumber: invoice.number,
        customerName: contactName(contacts, invoice.contactId),
        contactId: invoice.contactId,
        amountCents: invoice.totalCents,
        currency: invoice.currency,
        paidAt: invoice.paidAt,
        confidence: "review",
        candidateTransactionId: candidate.id,
        reason: "Possible transaction match found by contact, amount, currency, and date window. Review before treating as missing."
      });
      continue;
    }

    paidWithoutCharge.push({
      invoiceId: invoice.id,
      invoiceNumber: invoice.number,
      customerName: contactName(contacts, invoice.contactId),
      contactId: invoice.contactId,
      amountCents: invoice.totalCents,
      currency: invoice.currency,
      paidAt: invoice.paidAt,
      confidence: "missing",
      reason: "Invoice is marked paid, but no captured payment transaction is linked or plausibly matched."
    });
  }

  for (const transaction of capturedTransactions) {
    if (exactTransactionIds.has(transaction.id)) {
      continue;
    }

    const reviewInvoice = reviewTransactionToInvoice.get(transaction.id) ?? findFuzzyInvoice(transaction, input.invoices, exactInvoiceIds);
    chargeWithoutInvoice.push({
      transactionId: transaction.id,
      providerChargeId: transaction.providerChargeId,
      customerName: contactName(contacts, transaction.contactId ?? reviewInvoice?.contactId),
      contactId: transaction.contactId ?? reviewInvoice?.contactId,
      amountCents: transaction.amountCents,
      currency: transaction.currency,
      chargedAt: transaction.createdAt,
      confidence: reviewInvoice ? "review" : "missing",
      candidateInvoiceId: reviewInvoice?.id,
      reason: reviewInvoice
        ? "Possible invoice match found by contact, amount, currency, and date window. Review before treating as orphaned."
        : "Captured payment transaction has no linked or plausibly matched paid invoice."
    });
  }

  const revenueAtRiskCents =
    paidWithoutCharge
      .filter((row) => row.confidence === "missing")
      .reduce((total, row) => total + row.amountCents, 0) +
    activeSubFailedPayment.reduce((total, row) => total + row.amountCents, 0);

  return {
    dateRange: input.dateRange,
    revenueAtRiskCents,
    currency: inferCurrency(input),
    tables: {
      paidWithoutCharge,
      chargeWithoutInvoice,
      activeSubFailedPayment,
      amountCurrencyMismatch
    }
  };
}

function buildExactMatches(invoices: Invoice[], transactions: Transaction[]): Map<Invoice, Transaction> {
  const matches = new Map<Invoice, Transaction>();

  for (const invoice of invoices) {
    const transaction = transactions.find((candidate) => isExactInvoiceTransactionMatch(invoice, candidate));
    if (transaction) {
      matches.set(invoice, transaction);
    }
  }

  return matches;
}

function isExactInvoiceTransactionMatch(invoice: Invoice, transaction: Transaction): boolean {
  return (
    transaction.invoiceId === invoice.id ||
    Boolean(invoice.orderId && transaction.orderId && transaction.orderId === invoice.orderId) ||
    invoice.transactionIds?.includes(transaction.id) === true ||
    Boolean(invoice.providerChargeId && invoice.providerChargeId === transaction.providerChargeId)
  );
}

function findFuzzyTransaction(
  invoice: Invoice,
  transactions: Transaction[],
  exactTransactionIds: Set<string>
): Transaction | undefined {
  return transactions.find(
    (transaction) =>
      !exactTransactionIds.has(transaction.id) &&
      transaction.contactId === invoice.contactId &&
      transaction.amountCents === invoice.totalCents &&
      transaction.currency === invoice.currency &&
      isWithinDateWindow(invoice.paidAt ?? invoice.createdAt, transaction.createdAt)
  );
}

function findFuzzyInvoice(transaction: Transaction, invoices: Invoice[], exactInvoiceIds: Set<string>): Invoice | undefined {
  return invoices.find(
    (invoice) =>
      isPaidInvoice(invoice) &&
      !exactInvoiceIds.has(invoice.id) &&
      invoice.contactId === transaction.contactId &&
      invoice.totalCents === transaction.amountCents &&
      invoice.currency === transaction.currency &&
      isWithinDateWindow(invoice.paidAt ?? invoice.createdAt, transaction.createdAt)
  );
}

function isWithinDateWindow(leftIso: string, rightIso: string): boolean {
  const left = new Date(leftIso).getTime();
  const right = new Date(rightIso).getTime();
  if (Number.isNaN(left) || Number.isNaN(right)) {
    return false;
  }
  const deltaDays = Math.abs(left - right) / 86_400_000;
  return deltaDays <= FUZZY_DATE_WINDOW_DAYS;
}

function isPaidInvoice(invoice: Invoice): boolean {
  return PAID_INVOICE_STATUSES.has(invoice.status.toLowerCase()) || invoice.balanceCents === 0;
}

function isCapturedTransaction(transaction: Transaction): boolean {
  return CAPTURED_TRANSACTION_STATUSES.has(transaction.status.toLowerCase());
}

function hasActiveFailedPayment(subscription: Subscription): boolean {
  const status = subscription.status.toLowerCase();
  const latestPaymentStatus = subscription.latestPaymentStatus?.toLowerCase() ?? "";
  return ACTIVE_SUBSCRIPTION_STATUSES.has(status) && FAILED_PAYMENT_STATUSES.has(latestPaymentStatus);
}

function subscriptionRiskRow(subscription: Subscription, contacts: Map<string, Contact>): ActiveSubFailedPaymentRow {
  return {
    subscriptionId: subscription.id,
    customerName: contactName(contacts, subscription.contactId),
    contactId: subscription.contactId,
    status: subscription.status,
    latestPaymentStatus: subscription.latestPaymentStatus,
    amountCents: subscription.amountCents ?? 0,
    currency: subscription.currency ?? "USD",
    serviceLabel: subscription.serviceLabel,
    reason: "Subscription is still active, but the latest payment status is failed or past due."
  };
}

function contactName(contacts: Map<string, Contact>, contactId: string | undefined): string {
  if (!contactId) {
    return "Unknown customer";
  }
  const contact = contacts.get(contactId);
  return contact?.name ?? contact?.email ?? contactId;
}

function inferCurrency(input: ReconcileInput): string {
  return (
    input.invoices[0]?.currency ??
    input.transactions[0]?.currency ??
    input.subscriptions.find((subscription) => subscription.currency)?.currency ??
    "USD"
  );
}
