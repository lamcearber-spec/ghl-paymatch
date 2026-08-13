import { describe, expect, it, vi } from "vitest";
import type { MarketplaceBillingEvent } from "@/lib/billing/entitlements";
import type { InstallationStore } from "@/lib/store/installations";
import { handleMarketplaceWebhook } from "./route";

describe("POST /api/ghl/webhook", () => {
  it("rejects an unsigned billing event", async () => {
    const response = await handleMarketplaceWebhook(webhookRequest({ type: "INSTALL" }), {
      verifySignature: () => false,
      applyEvent: vi.fn()
    });

    expect(response.status).toBe(401);
  });

  it("applies a signed marketplace event", async () => {
    const applyEvent = vi.fn(async (_event: MarketplaceBillingEvent) => undefined);
    const payload: MarketplaceBillingEvent = {
      type: "PLAN_CHANGE",
      appId: "app_paymatch",
      locationId: "loc_1",
      currentPlanId: "plan_starter",
      newPlanId: "plan_pro"
    };

    const response = await handleMarketplaceWebhook(webhookRequest(payload), {
      verifySignature: () => true,
      applyEvent
    });

    expect(response.status).toBe(200);
    expect(applyEvent).toHaveBeenCalledWith(payload);
  });

  it("provisions the installed sub-account from a signed install event", async () => {
    const provisionLocation = vi.fn(async () => undefined);
    const payload: MarketplaceBillingEvent = {
      type: "INSTALL",
      appId: "app_paymatch",
      companyId: "company_1",
      locationId: "loc_1"
    };

    const response = await handleMarketplaceWebhook(webhookRequest(payload), {
      verifySignature: () => true,
      applyEvent: vi.fn(async () => undefined),
      provisionLocation
    });

    expect(response.status).toBe(200);
    expect(provisionLocation).toHaveBeenCalledWith({ companyId: "company_1", locationId: "loc_1" });
  });

  it("returns a stable client error for an unsupported event", async () => {
    const response = await handleMarketplaceWebhook(webhookRequest({ type: "CONTACT_CREATE" }), {
      verifySignature: () => true,
      applyEvent: vi.fn(async () => {
        throw new Error("Unsupported marketplace webhook event.");
      })
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Unsupported marketplace webhook event." });
  });

  it("removes OAuth credentials when the generic webhook receives an uninstall", async () => {
    const installationStore = fakeInstallationStore();
    const response = await handleMarketplaceWebhook(
      webhookRequest({ type: "UNINSTALL", appId: "app_paymatch", locationId: "loc_1" }),
      {
        verifySignature: () => true,
        applyEvent: vi.fn(async () => undefined),
        installationStore
      }
    );

    expect(response.status).toBe(200);
    expect(installationStore.delete).toHaveBeenCalledWith("loc_1");
  });
});

function webhookRequest(payload: object): Request {
  return new Request("https://paymatch.test/api/ghl/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-GHL-Signature": "signature" },
    body: JSON.stringify(payload)
  });
}

function fakeInstallationStore(): InstallationStore {
  return {
    get: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(async () => undefined)
  };
}
