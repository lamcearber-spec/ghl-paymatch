import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/reconcile", () => {
  it("returns a fixture-backed PayMatch scan with CSV exports", async () => {
    const response = await GET(
      new Request("https://paymatch.test/api/reconcile?locationId=demo-location&from=2026-05-01&to=2026-05-31")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.mode).toBe("fixture");
    expect(payload.result.revenueAtRiskCents).toBeGreaterThan(0);
    expect(payload.result.tables.paidWithoutCharge.length).toBeGreaterThan(0);
    expect(payload.csv.paidWithoutCharge).toContain("invoiceId");
    expect(payload.csv.amountCurrencyMismatch).toContain("invoiceAmountCents");
  });
});
