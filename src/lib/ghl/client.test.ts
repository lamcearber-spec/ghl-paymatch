import { describe, expect, it } from "vitest";
import { buildGhlUrl, normalizeInvoice, normalizeSubscription, normalizeTransaction } from "./client";

describe("HighLevel client helpers", () => {
  it("builds versioned read-only list URLs with location and date filters", () => {
    const url = buildGhlUrl("/payments/transactions", {
      locationId: "loc_123",
      startAt: "2026-05-01",
      endAt: "2026-05-31",
      limit: 100,
      page: 2
    });

    expect(url.toString()).toBe(
      "https://services.leadconnectorhq.com/payments/transactions?locationId=loc_123&startAt=2026-05-01&endAt=2026-05-31&limit=100&page=2"
    );
  });

  it("normalizes HighLevel invoice fields without requiring write access", () => {
    expect(
      normalizeInvoice({
        _id: "inv_123",
        invoiceNumber: "INV-123",
        contactId: "contact_123",
        status: "paid",
        total: 125.5,
        currency: "usd",
        paidAt: "2026-05-22T10:00:00.000Z",
        createdAt: "2026-05-20T10:00:00.000Z",
        transactionId: "txn_123"
      })
    ).toMatchObject({
      id: "inv_123",
      number: "INV-123",
      totalCents: 12550,
      currency: "USD",
      transactionIds: ["txn_123"]
    });
  });

  it("normalizes provider charge and linkage fields when GHL exposes them", () => {
    expect(
      normalizeTransaction({
        id: "txn_123",
        invoiceId: "inv_123",
        contactId: "contact_123",
        status: "succeeded",
        amount: 12000,
        currency: "USD",
        createdAt: "2026-05-22T10:00:00.000Z",
        providerChargeId: "ch_123"
      })
    ).toMatchObject({
      id: "txn_123",
      invoiceId: "inv_123",
      amountCents: 12000,
      providerChargeId: "ch_123"
    });
  });

  it("normalizes active subscriptions and latest payment status", () => {
    expect(
      normalizeSubscription({
        id: "sub_123",
        contactId: "contact_123",
        status: "active",
        latestPaymentStatus: "failed",
        amount: 39,
        currency: "usd",
        productName: "Monthly Retainer"
      })
    ).toMatchObject({
      id: "sub_123",
      amountCents: 3900,
      currency: "USD",
      serviceLabel: "Monthly Retainer"
    });
  });
});
