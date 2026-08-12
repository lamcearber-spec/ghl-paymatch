import { describe, expect, it, vi } from "vitest";
import { handleBillingStatus } from "./route";
import { readInstallationSession } from "@/lib/security/installation-session";

vi.mock("@/lib/security/installation-session", () => ({
  readInstallationSession: vi.fn((session: string) => session === "valid_session" ? "loc_1" : (() => { throw new Error("invalid"); })())
}));

describe("GET /api/billing/status", () => {
  it("requires an installation id", async () => {
    const response = await handleBillingStatus(new Request("https://paymatch.test/api/billing/status"));

    expect(response.status).toBe(400);
  });

  it("returns the server-side entitlement without exposing plan identifiers", async () => {
    const getEntitlement = vi.fn(async () => ({ plan: "starter" as const, locationLimit: 1, scansRemaining: null }));
    const response = await handleBillingStatus(
      new Request("https://paymatch.test/api/billing/status?session=valid_session"),
      { getEntitlement }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ plan: "starter", locationLimit: 1, scansRemaining: null });
    expect(getEntitlement).toHaveBeenCalledWith("loc_1");
  });

  it("rejects a tampered session", async () => {
    vi.mocked(readInstallationSession).mockImplementationOnce(() => { throw new Error("invalid"); });
    const response = await handleBillingStatus(new Request("https://paymatch.test/api/billing/status?session=tampered"));

    expect(response.status).toBe(401);
  });
});
