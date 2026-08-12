import { describe, expect, it, vi } from "vitest";
import {
  applyMarketplaceBillingEvent,
  getEntitlementStore,
  getPayMatchEntitlement,
  releasePayMatchScan,
  reservePayMatchScan,
  type BillingState,
  type EntitlementStore
} from "./entitlements";

const PLAN_IDS = {
  starter: "plan_starter",
  pro: "plan_pro"
};

describe("PayMatch entitlements", () => {
  it("gives an installation one free scan when no billing state exists", async () => {
    const entitlement = await getPayMatchEntitlement("loc_free", {
      store: fakeStore(),
      planIds: PLAN_IDS
    });

    expect(entitlement).toEqual({ plan: "free", locationLimit: 1, scansRemaining: 1 });
  });

  it("unlocks Starter only for a recognized plan with complete payment", async () => {
    const store = fakeStore({
      installationId: "loc_starter",
      planId: "plan_starter",
      paymentStatus: "COMPLETE",
      scansUsed: 1,
      updatedAt: "2026-08-12T10:00:00.000Z"
    });

    await expect(getPayMatchEntitlement("loc_starter", { store, planIds: PLAN_IDS })).resolves.toEqual({
      plan: "starter",
      locationLimit: 1,
      scansRemaining: null
    });
  });

  it("fails closed after a paid-plan payment failure", async () => {
    const store = fakeStore({
      installationId: "loc_failed",
      planId: "plan_pro",
      paymentStatus: "FAILED",
      scansUsed: 1,
      updatedAt: "2026-08-12T10:00:00.000Z"
    });

    await expect(getPayMatchEntitlement("loc_failed", { store, planIds: PLAN_IDS })).resolves.toEqual({
      plan: "free",
      locationLimit: 1,
      scansRemaining: 0
    });
  });

  it("honors an active trial and expires it deterministically", async () => {
    const store = fakeStore({
      installationId: "loc_trial",
      planId: "plan_pro",
      paymentStatus: "PENDING",
      trialEndsAt: "2026-08-20T00:00:00.000Z",
      scansUsed: 0,
      updatedAt: "2026-08-12T10:00:00.000Z"
    });

    await expect(
      getPayMatchEntitlement("loc_trial", {
        store,
        planIds: PLAN_IDS,
        now: new Date("2026-08-19T23:59:59.000Z")
      })
    ).resolves.toMatchObject({ plan: "pro", scansRemaining: null });

    await expect(
      getPayMatchEntitlement("loc_trial", {
        store,
        planIds: PLAN_IDS,
        now: new Date("2026-08-20T00:00:00.000Z")
      })
    ).resolves.toMatchObject({ plan: "free", scansRemaining: 1 });
  });

  it("reserves and releases the single free scan atomically", async () => {
    const store = fakeStore();

    await expect(reservePayMatchScan("loc_free", { store, planIds: PLAN_IDS })).resolves.toEqual({
      allowed: true,
      consumedFreeScan: true
    });
    expect(store.reserveFreeScan).toHaveBeenCalledWith("loc_free");

    await releasePayMatchScan("loc_free", { store });
    expect(store.releaseFreeScan).toHaveBeenCalledWith("loc_free");
  });

  it("does not consume a scan for a paid entitlement", async () => {
    const store = fakeStore({
      installationId: "loc_pro",
      planId: "plan_pro",
      paymentStatus: "COMPLETE",
      scansUsed: 0,
      updatedAt: "2026-08-12T10:00:00.000Z"
    });

    await expect(reservePayMatchScan("loc_pro", { store, planIds: PLAN_IDS })).resolves.toEqual({
      allowed: true,
      consumedFreeScan: false
    });
    expect(store.reserveFreeScan).not.toHaveBeenCalled();
  });

  it("denies a second free scan without marking it as consumed", async () => {
    const store = fakeStore();
    vi.mocked(store.reserveFreeScan).mockResolvedValue(false);

    await expect(reservePayMatchScan("loc_free", { store, planIds: PLAN_IDS })).resolves.toEqual({
      allowed: false,
      consumedFreeScan: false
    });
  });
});

describe("HighLevel billing events", () => {
  it("persists plan and trial state from an install event", async () => {
    const store = fakeStore();

    await applyMarketplaceBillingEvent(
      {
        type: "INSTALL",
        appId: "app_paymatch",
        locationId: "loc_install",
        planId: "plan_pro",
        trial: {
          onTrial: true,
          trialDuration: 14,
          trialStartDate: "2026-08-12T00:00:00.000Z"
        }
      },
      { store, expectedAppId: "app_paymatch" }
    );

    expect(store.upsertPlan).toHaveBeenCalledWith({
      installationId: "loc_install",
      planId: "plan_pro",
      paymentStatus: "PENDING",
      trialEndsAt: "2026-08-26T00:00:00.000Z"
    });
  });

  it("persists a changed plan and complete payment state", async () => {
    const store = fakeStore();

    await applyMarketplaceBillingEvent(
      {
        type: "PLAN_CHANGE",
        appId: "app_paymatch",
        locationId: "loc_change",
        currentPlanId: "plan_starter",
        newPlanId: "plan_pro"
      },
      { store, expectedAppId: "app_paymatch" }
    );

    expect(store.upsertPlan).toHaveBeenCalledWith({
      installationId: "loc_change",
      planId: "plan_pro",
      paymentStatus: "COMPLETE",
      trialEndsAt: null
    });
  });

  it("updates payment status without erasing the selected plan", async () => {
    const store = fakeStore();

    await applyMarketplaceBillingEvent(
      {
        type: "APP_PAYMENT_STATUS",
        appId: "app_paymatch",
        companyId: "company_1",
        previousStatus: "COMPLETE",
        newStatus: "FAILED"
      },
      { store, expectedAppId: "app_paymatch" }
    );

    expect(store.setPaymentStatus).toHaveBeenCalledWith("company_1", "FAILED");
  });

  it("rejects events for another app", async () => {
    await expect(
      applyMarketplaceBillingEvent(
        { type: "INSTALL", appId: "another_app", locationId: "loc_1" },
        { store: fakeStore(), expectedAppId: "app_paymatch" }
      )
    ).rejects.toThrow("Webhook does not match this app");
  });

  it("preserves trial state when an app update omits trial data", async () => {
    const store = getEntitlementStore({ environment: "test" });
    const installationId = "loc_trial_update";
    await store.delete(installationId);

    await applyMarketplaceBillingEvent(
      {
        type: "INSTALL",
        appId: "app_paymatch",
        locationId: installationId,
        planId: "plan_pro",
        trial: { onTrial: true, trialDuration: 14, trialStartDate: "2026-08-12T00:00:00.000Z" }
      },
      { store, expectedAppId: "app_paymatch" }
    );
    await applyMarketplaceBillingEvent(
      { type: "UPDATE", appId: "app_paymatch", locationId: installationId, planId: "plan_pro" },
      { store, expectedAppId: "app_paymatch" }
    );

    expect(await store.get(installationId)).toMatchObject({ trialEndsAt: "2026-08-26T00:00:00.000Z" });
  });
});

function fakeStore(state?: BillingState): EntitlementStore {
  return {
    get: vi.fn(async () => state),
    upsertPlan: vi.fn(async () => undefined),
    setPaymentStatus: vi.fn(async () => undefined),
    reserveFreeScan: vi.fn(async () => true),
    releaseFreeScan: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined)
  };
}
