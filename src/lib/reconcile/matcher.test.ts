import { describe, expect, it } from "vitest";
import { reconcilePayMatch } from "./matcher";

describe("reconcilePayMatch", () => {
  it("flags paid invoices without charges, orphan charges, failed active subscriptions, and linked mismatches", () => {
    const result = reconcilePayMatch({
      dateRange: { from: "2026-05-01", to: "2026-05-31" },
      contacts: [{ id: "contact-1", name: "Northstar Dental", email: "billing@northstar.test" }],
      invoices: [
        {
          id: "inv-missing",
          number: "1007",
          contactId: "contact-1",
          status: "paid",
          totalCents: 12000,
          currency: "USD",
          paidAt: "2026-05-22T10:00:00.000Z",
          createdAt: "2026-05-20T10:00:00.000Z"
        },
        {
          id: "inv-mismatch",
          number: "1008",
          contactId: "contact-1",
          status: "paid",
          totalCents: 5000,
          currency: "USD",
          transactionIds: ["txn-mismatch"],
          paidAt: "2026-05-22T10:00:00.000Z",
          createdAt: "2026-05-20T10:00:00.000Z"
        }
      ],
      transactions: [
        {
          id: "txn-orphan",
          contactId: "contact-1",
          status: "captured",
          amountCents: 9900,
          currency: "USD",
          createdAt: "2026-05-23T10:00:00.000Z",
          providerChargeId: "ch_orphan"
        },
        {
          id: "txn-mismatch",
          invoiceId: "inv-mismatch",
          contactId: "contact-1",
          status: "captured",
          amountCents: 5500,
          currency: "USD",
          createdAt: "2026-05-22T10:05:00.000Z",
          providerChargeId: "ch_mismatch"
        }
      ],
      subscriptions: [
        {
          id: "sub-failed",
          contactId: "contact-1",
          status: "active",
          latestPaymentStatus: "failed",
          amountCents: 4500,
          currency: "USD",
          serviceLabel: "Retainer"
        }
      ]
    });

    expect(result.revenueAtRiskCents).toBe(16500);
    expect(result.tables.paidWithoutCharge).toHaveLength(1);
    expect(result.tables.paidWithoutCharge[0]).toMatchObject({
      invoiceId: "inv-missing",
      confidence: "missing",
      amountCents: 12000
    });
    expect(result.tables.chargeWithoutInvoice).toHaveLength(1);
    expect(result.tables.chargeWithoutInvoice[0]).toMatchObject({
      transactionId: "txn-orphan",
      amountCents: 9900,
      confidence: "missing"
    });
    expect(result.tables.activeSubFailedPayment).toHaveLength(1);
    expect(result.tables.activeSubFailedPayment[0]).toMatchObject({
      subscriptionId: "sub-failed",
      amountCents: 4500
    });
    expect(result.tables.amountCurrencyMismatch).toHaveLength(1);
    expect(result.tables.amountCurrencyMismatch[0]).toMatchObject({
      invoiceId: "inv-mismatch",
      transactionId: "txn-mismatch",
      invoiceAmountCents: 5000,
      transactionAmountCents: 5500
    });
  });

  it("labels fallback contact amount date matches as review and excludes them from revenue at risk", () => {
    const result = reconcilePayMatch({
      dateRange: { from: "2026-05-01", to: "2026-05-31" },
      contacts: [{ id: "contact-2", name: "Ledger Lane" }],
      invoices: [
        {
          id: "inv-review",
          number: "1012",
          contactId: "contact-2",
          status: "paid",
          totalCents: 7777,
          currency: "USD",
          paidAt: "2026-05-11T09:00:00.000Z",
          createdAt: "2026-05-10T09:00:00.000Z"
        }
      ],
      transactions: [
        {
          id: "txn-review",
          contactId: "contact-2",
          status: "succeeded",
          amountCents: 7777,
          currency: "USD",
          createdAt: "2026-05-12T09:00:00.000Z",
          providerChargeId: "ch_review"
        }
      ],
      subscriptions: []
    });

    expect(result.revenueAtRiskCents).toBe(0);
    expect(result.tables.paidWithoutCharge[0]).toMatchObject({
      invoiceId: "inv-review",
      candidateTransactionId: "txn-review",
      confidence: "review"
    });
    expect(result.tables.chargeWithoutInvoice[0]).toMatchObject({
      transactionId: "txn-review",
      candidateInvoiceId: "inv-review",
      confidence: "review"
    });
  });

  it("reports source counts, match counts, findings, and partial pagination warnings", () => {
    const result = reconcilePayMatch({
      dateRange: { from: "2026-08-01", to: "2026-08-31" },
      contacts: [{ id: "contact-1", name: "Agency" }],
      invoices: [
        {
          id: "inv-1",
          contactId: "contact-1",
          status: "paid",
          totalCents: 3900,
          currency: "USD",
          transactionIds: ["txn-1"],
          createdAt: "2026-08-01T00:00:00.000Z"
        }
      ],
      transactions: [
        {
          id: "txn-1",
          invoiceId: "inv-1",
          contactId: "contact-1",
          status: "captured",
          amountCents: 3900,
          currency: "USD",
          createdAt: "2026-08-01T00:00:00.000Z"
        }
      ],
      subscriptions: [],
      products: [{ id: "product-1", name: "Retainer" }],
      sourceCompleteness: {
        invoices: {
          complete: false,
          pagesRead: 1,
          reportedTotal: 200,
          warning: "HighLevel stopped responding after page 1; this source is partial."
        },
        transactions: { complete: true, pagesRead: 1, reportedTotal: 1 },
        subscriptions: { complete: true, pagesRead: 1, reportedTotal: 0 },
        contacts: { complete: true, pagesRead: 1, reportedTotal: 1 },
        products: { complete: true, pagesRead: 1, reportedTotal: 1 }
      }
    });

    expect(result.summary.sourceCounts).toEqual({ invoices: 1, transactions: 1, subscriptions: 0, contacts: 1, products: 1 });
    expect(result.summary.matchCounts).toEqual({ exact: 1, review: 0 });
    expect(result.summary.findingCounts).toEqual({
      paidWithoutCharge: 0,
      chargeWithoutInvoice: 0,
      activeSubFailedPayment: 0,
      amountCurrencyMismatch: 0
    });
    expect(result.summary.paginationComplete).toBe(false);
    expect(result.summary.warnings).toContain("Invoices: HighLevel stopped responding after page 1; this source is partial.");
  });

  it("does not report a refunded transaction as an orphaned captured charge", () => {
    const result = reconcilePayMatch({
      dateRange: { from: "2026-08-01", to: "2026-08-31" },
      contacts: [],
      invoices: [],
      transactions: [
        {
          id: "txn-refund",
          status: "refunded",
          amountCents: -3900,
          currency: "USD",
          createdAt: "2026-08-02T00:00:00.000Z"
        }
      ],
      subscriptions: []
    });

    expect(result.tables.chargeWithoutInvoice).toHaveLength(0);
  });

  it("explains a second captured charge linked to the same invoice as a duplicate", () => {
    const result = reconcilePayMatch({
      dateRange: { from: "2026-08-01", to: "2026-08-31" },
      contacts: [{ id: "contact-1", name: "Agency" }],
      invoices: [
        {
          id: "inv-duplicate",
          contactId: "contact-1",
          status: "paid",
          totalCents: 3900,
          currency: "USD",
          transactionIds: ["txn-original"],
          createdAt: "2026-08-01T00:00:00.000Z"
        }
      ],
      transactions: [
        {
          id: "txn-original",
          invoiceId: "inv-duplicate",
          contactId: "contact-1",
          status: "captured",
          amountCents: 3900,
          currency: "USD",
          createdAt: "2026-08-01T00:00:00.000Z"
        },
        {
          id: "txn-duplicate",
          invoiceId: "inv-duplicate",
          contactId: "contact-1",
          status: "captured",
          amountCents: 3900,
          currency: "USD",
          createdAt: "2026-08-01T00:01:00.000Z"
        }
      ],
      subscriptions: []
    });

    expect(result.tables.chargeWithoutInvoice).toHaveLength(1);
    expect(result.tables.chargeWithoutInvoice[0]).toMatchObject({
      transactionId: "txn-duplicate",
      confidence: "missing",
      candidateInvoiceId: "inv-duplicate",
      reason: "Multiple captured charges are linked to the same invoice. Confirm whether the second charge should be refunded."
    });
  });

  it("reports a linked currency mismatch even when amounts agree", () => {
    const result = reconcilePayMatch({
      dateRange: { from: "2026-08-01", to: "2026-08-31" },
      contacts: [],
      invoices: [
        {
          id: "inv-currency",
          status: "paid",
          totalCents: 3900,
          currency: "EUR",
          transactionIds: ["txn-currency"],
          createdAt: "2026-08-01T00:00:00.000Z"
        }
      ],
      transactions: [
        {
          id: "txn-currency",
          invoiceId: "inv-currency",
          status: "captured",
          amountCents: 3900,
          currency: "USD",
          createdAt: "2026-08-01T00:00:00.000Z"
        }
      ],
      subscriptions: []
    });

    expect(result.tables.amountCurrencyMismatch[0]).toMatchObject({
      invoiceCurrency: "EUR",
      transactionCurrency: "USD",
      reason: "Linked invoice and captured transaction do not agree on amount or currency."
    });
  });
});
