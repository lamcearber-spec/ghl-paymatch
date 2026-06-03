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
});
