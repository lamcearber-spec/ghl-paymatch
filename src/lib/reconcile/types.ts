export type CurrencyCode = string;

export type DateRange = {
  from: string;
  to: string;
};

export type Contact = {
  id: string;
  name?: string;
  email?: string;
};

export type Invoice = {
  id: string;
  number?: string;
  contactId?: string;
  status: string;
  totalCents: number;
  currency: CurrencyCode;
  amountPaidCents?: number;
  balanceCents?: number;
  transactionIds?: string[];
  providerChargeId?: string;
  orderId?: string;
  paidAt?: string;
  createdAt: string;
};

export type Transaction = {
  id: string;
  invoiceId?: string;
  orderId?: string;
  contactId?: string;
  subscriptionId?: string;
  providerChargeId?: string;
  status: string;
  amountCents: number;
  currency: CurrencyCode;
  createdAt: string;
};

export type Subscription = {
  id: string;
  contactId?: string;
  status: string;
  latestPaymentStatus?: string;
  latestTransactionId?: string;
  amountCents?: number;
  currency?: CurrencyCode;
  serviceLabel?: string;
};

export type ReconcileInput = {
  dateRange: DateRange;
  contacts: Contact[];
  invoices: Invoice[];
  transactions: Transaction[];
  subscriptions: Subscription[];
};

export type MatchConfidence = "missing" | "review";

export type PaidWithoutChargeRow = {
  invoiceId: string;
  invoiceNumber?: string;
  customerName: string;
  contactId?: string;
  amountCents: number;
  currency: CurrencyCode;
  paidAt?: string;
  confidence: MatchConfidence;
  candidateTransactionId?: string;
  reason: string;
};

export type ChargeWithoutInvoiceRow = {
  transactionId: string;
  providerChargeId?: string;
  customerName: string;
  contactId?: string;
  amountCents: number;
  currency: CurrencyCode;
  chargedAt: string;
  confidence: MatchConfidence;
  candidateInvoiceId?: string;
  reason: string;
};

export type ActiveSubFailedPaymentRow = {
  subscriptionId: string;
  customerName: string;
  contactId?: string;
  status: string;
  latestPaymentStatus?: string;
  amountCents: number;
  currency: CurrencyCode;
  serviceLabel?: string;
  reason: string;
};

export type AmountCurrencyMismatchRow = {
  invoiceId: string;
  invoiceNumber?: string;
  transactionId: string;
  providerChargeId?: string;
  customerName: string;
  invoiceAmountCents: number;
  transactionAmountCents: number;
  invoiceCurrency: CurrencyCode;
  transactionCurrency: CurrencyCode;
  reason: string;
};

export type ReconcileResult = {
  dateRange: DateRange;
  revenueAtRiskCents: number;
  currency: CurrencyCode;
  tables: {
    paidWithoutCharge: PaidWithoutChargeRow[];
    chargeWithoutInvoice: ChargeWithoutInvoiceRow[];
    activeSubFailedPayment: ActiveSubFailedPaymentRow[];
    amountCurrencyMismatch: AmountCurrencyMismatchRow[];
  };
};
