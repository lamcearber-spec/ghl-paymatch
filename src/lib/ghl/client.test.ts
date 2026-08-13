import { describe, expect, it, vi } from "vitest";
import {
  HighLevelClient,
  HighLevelRequestError,
  buildGhlUrl,
  normalizeInvoice,
  normalizeSubscription,
  normalizeTransaction
} from "./client";

describe("HighLevel client helpers", () => {
  it("builds read-only list URLs with required altId and altType filters", () => {
    const url = buildGhlUrl("/payments/transactions", {
      altId: "loc_123",
      altType: "location",
      startAt: "2026-05-01",
      endAt: "2026-05-31",
      limit: 100,
      offset: 100
    });

    expect(url.toString()).toBe(
      "https://services.leadconnectorhq.com/payments/transactions?altId=loc_123&altType=location&startAt=2026-05-01&endAt=2026-05-31&limit=100&offset=100"
    );
  });

  it("paginates payment transactions by offset until fewer than the limit are returned", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: Array.from({ length: 100 }, (_, index) => ({
            _id: `txn_${index}`,
            status: "captured",
            amount: 10,
            currency: "USD",
            createdAt: "2026-05-01T00:00:00.000Z"
          })),
          totalCount: 101
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              _id: "txn_100",
              status: "captured",
              amount: 10,
              currency: "USD",
              createdAt: "2026-05-02T00:00:00.000Z"
            }
          ],
          totalCount: 101
        })
      );

    const client = new HighLevelClient("token", fetcher);
    const transactions = await client.listTransactions("loc_123", { from: "2026-05-01", to: "2026-05-31" });
    const calledUrls = fetcher.mock.calls.map(([url]) => String(url));

    expect(transactions).toHaveLength(101);
    expect(calledUrls[0]).toContain("altId=loc_123");
    expect(calledUrls[0]).toContain("altType=location");
    expect(calledUrls[0]).toContain("offset=0");
    expect(calledUrls[1]).toContain("offset=100");
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      headers: expect.objectContaining({ Version: "2021-07-28" })
    });
  });

  it("uses the API version required by each HighLevel product family", async () => {
    const fetcher = vi.fn().mockImplementation(async () => jsonResponse({ data: [] }));
    const client = new HighLevelClient("token", fetcher);

    await client.listInvoices("loc_123", { from: "2026-05-01", to: "2026-05-31" });
    await client.listContacts("loc_123");
    await client.listSubscriptions("loc_123");
    await client.listProducts("loc_123");

    const versionFor = (callIndex: number) => {
      const headers = fetcher.mock.calls[callIndex]?.[1]?.headers as Record<string, string>;
      return headers.Version;
    };

    expect(versionFor(0)).toBe("2023-02-21");
    expect(versionFor(1)).toBe("2023-02-21");
    expect(versionFor(2)).toBe("2021-07-28");
    expect(versionFor(3)).toBe("2021-07-28");
  });

  it("identifies the rejected HighLevel source without exposing credentials", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    const client = new HighLevelClient("private-token", fetcher);

    const request = client.listContacts("loc_123");

    await expect(request).rejects.toBeInstanceOf(HighLevelRequestError);
    await expect(request).rejects.toMatchObject({
      name: "HighLevelRequestError",
      path: "/contacts/",
      status: 401
    });
    await expect(request).rejects.not.toHaveProperty("accessToken");
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

  it("normalizes documented HighLevel invoice list fields", () => {
    expect(
      normalizeInvoice({
        _id: "6578278e879ad2646715ba9c",
        invoiceNumber: 19,
        contactDetails: { id: "contact_123", name: "Alex" },
        status: "paid",
        total: 999,
        amountPaid: 999,
        amountDue: 0,
        currency: "USD",
        issueDate: "2026-05-01",
        createdAt: "2026-05-01T00:00:00.000Z"
      })
    ).toMatchObject({
      id: "6578278e879ad2646715ba9c",
      number: "19",
      contactId: "contact_123",
      totalCents: 99900,
      amountPaidCents: 99900,
      balanceCents: 0
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

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
