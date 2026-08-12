import { describe, expect, it, vi } from "vitest";
import { HighLevelClient } from "@/lib/ghl/client";

describe("PayMatch source pagination", () => {
  it.each([
    ["invoices", (client: HighLevelClient) => client.readInvoices("loc_1", dateRange()), "invoices", invoice],
    ["transactions", (client: HighLevelClient) => client.readTransactions("loc_1", dateRange()), "data", transaction],
    ["subscriptions", (client: HighLevelClient) => client.readSubscriptions("loc_1"), "data", subscription],
    ["products", (client: HighLevelClient) => client.readProducts("loc_1"), "products", product]
  ])("reads every %s page and reports completeness", async (_name, read, responseKey, recordFactory) => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({
        [responseKey]: Array.from({ length: 100 }, (_, index) => recordFactory(index)),
        totalCount: 101
      }))
      .mockResolvedValueOnce(jsonResponse({ [responseKey]: [recordFactory(100)], totalCount: 101 }));

    const result = await read(new HighLevelClient("token", fetcher));
    const urls = fetcher.mock.calls.map(([url]) => String(url));

    expect(result.records).toHaveLength(101);
    expect(result.completeness).toEqual({ complete: true, pagesRead: 2, reportedTotal: 101, warning: undefined });
    expect(urls[0]).toContain("offset=0");
    expect(urls[1]).toContain("offset=100");
  });

  it("paginates contacts with the documented startAfterId cursor", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) => contact(index));
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ contacts: firstPage, count: 101 }))
      .mockResolvedValueOnce(jsonResponse({ contacts: [contact(100)], count: 101 }));

    const result = await new HighLevelClient("token", fetcher).readContacts("loc_1");
    const urls = fetcher.mock.calls.map(([url]) => String(url));

    expect(result.records).toHaveLength(101);
    expect(result.completeness.complete).toBe(true);
    expect(urls[0]).not.toContain("startAfterId");
    expect(urls[1]).toContain("startAfterId=contact_99");
  });

  it("returns a clearly incomplete source when a later page fails", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ invoices: Array.from({ length: 100 }, (_, index) => invoice(index)), totalCount: 200 }))
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }));

    const result = await new HighLevelClient("token", fetcher).readInvoices("loc_1", dateRange());

    expect(result.records).toHaveLength(100);
    expect(result.completeness).toEqual({
      complete: false,
      pagesRead: 1,
      reportedTotal: 200,
      warning: "HighLevel stopped responding after page 1; this source is partial."
    });
  });
});

function dateRange() {
  return { from: "2026-08-01", to: "2026-08-31" };
}

function invoice(index: number) {
  return {
    _id: `invoice_${index}`,
    status: "paid",
    total: 10,
    currency: "USD",
    createdAt: "2026-08-01T00:00:00.000Z"
  };
}

function transaction(index: number) {
  return {
    _id: `transaction_${index}`,
    status: "captured",
    amount: 10,
    currency: "USD",
    createdAt: "2026-08-01T00:00:00.000Z"
  };
}

function subscription(index: number) {
  return { _id: `subscription_${index}`, status: "active", amount: 10, currency: "USD" };
}

function contact(index: number) {
  return { id: `contact_${index}`, name: `Contact ${index}`, dateAdded: "2026-08-01T00:00:00.000Z" };
}

function product(index: number) {
  return { _id: `product_${index}`, name: `Product ${index}` };
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
