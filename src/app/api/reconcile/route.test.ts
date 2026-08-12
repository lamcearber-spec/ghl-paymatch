import { describe, expect, it } from "vitest";
import { GET, handleReconcile } from "./route";
import { InstallationNotFoundError, TokenRefreshError } from "@/lib/ghl/session";

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

  it("returns a stable 404 when an installation no longer exists", async () => {
    const response = await handleReconcile(new Request("https://paymatch.test/api/reconcile?installationId=gone"), {
      scanner: async () => {
        throw new InstallationNotFoundError();
      }
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "installation_not_found", message: "Reconnect PayMatch to continue." });
  });

  it("returns a stable 502 when token refresh is rejected", async () => {
    const response = await handleReconcile(new Request("https://paymatch.test/api/reconcile?installationId=expired"), {
      scanner: async () => {
        throw new TokenRefreshError(401);
      }
    });

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "oauth_refresh_failed", message: "Reconnect PayMatch to continue." });
  });
});
