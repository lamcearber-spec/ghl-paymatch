type CsvValue = string | number | boolean | null | undefined;
type CsvRow = Record<string, CsvValue>;

export const PAYMATCH_CSV_HEADERS = {
  paidWithoutCharge: [
    "invoiceId", "invoiceNumber", "customerName", "contactId", "amountCents", "currency", "paidAt",
    "confidence", "candidateTransactionId", "reason"
  ],
  chargeWithoutInvoice: [
    "transactionId", "providerChargeId", "customerName", "contactId", "amountCents", "currency", "chargedAt",
    "confidence", "candidateInvoiceId", "reason"
  ],
  activeSubFailedPayment: [
    "subscriptionId", "customerName", "contactId", "status", "latestPaymentStatus", "amountCents", "currency",
    "serviceLabel", "reason"
  ],
  amountCurrencyMismatch: [
    "invoiceId", "invoiceNumber", "transactionId", "providerChargeId", "customerName", "invoiceAmountCents",
    "transactionAmountCents", "invoiceCurrency", "transactionCurrency", "reason"
  ]
} as const;

export type PayMatchCsvKind = keyof typeof PAYMATCH_CSV_HEADERS;

export function toCsv(rows: CsvRow[], explicitHeaders?: readonly string[]): string {
  const headers = explicitHeaders ?? (rows[0] ? Object.keys(rows[0]) : []);
  if (headers.length === 0) {
    return "";
  }

  const body = rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(","));
  return [headers.join(","), ...body].join("\r\n");
}

export function toPayMatchCsv(kind: PayMatchCsvKind, rows: CsvRow[]): string {
  return toCsv(rows, PAYMATCH_CSV_HEADERS[kind]);
}

function escapeCsv(value: CsvValue): string {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);
  if (!/[",\r\n]/.test(text)) {
    return text;
  }

  return `"${text.replaceAll('"', '""')}"`;
}
