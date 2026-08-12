import { describe, expect, it, vi } from "vitest";
import type { InstallationStore, PayMatchInstallation } from "@/lib/store/installations";
import { getValidInstallation } from "./session";

const expiredInstallation: PayMatchInstallation = {
  id: "loc_test",
  locationId: "loc_test",
  companyId: "company_test",
  userType: "Location",
  accessToken: "access_old",
  refreshToken: "refresh_old",
  expiresAt: "2026-08-12T09:00:00.000Z",
  scopes: ["invoices.readonly"],
  createdAt: "2026-08-11T09:00:00.000Z",
  updatedAt: "2026-08-11T09:00:00.000Z"
};

describe("getValidInstallation", () => {
  it("returns an unexpired installation without refreshing it", async () => {
    const store = fakeStore({ ...expiredInstallation, expiresAt: "2026-08-12T12:00:00.000Z" });
    const fetcher = vi.fn();

    const result = await getValidInstallation("loc_test", {
      store,
      fetcher,
      now: () => new Date("2026-08-12T10:00:00.000Z"),
      oauthConfig: oauthConfig()
    });

    expect(result.accessToken).toBe("access_old");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("refreshes an expired token and persists rotated credentials", async () => {
    const store = fakeStore(expiredInstallation);
    const recordEvent = vi.fn(async () => undefined);
    const fetcher = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify({
          access_token: "access_new",
          refresh_token: "refresh_new",
          token_type: "Bearer",
          expires_in: 86400,
          scope: "invoices.readonly payments/transactions.readonly"
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const result = await getValidInstallation("loc_test", {
      store,
      fetcher,
      now: () => new Date("2026-08-12T10:00:00.000Z"),
      oauthConfig: oauthConfig(),
      recordEvent
    });

    expect(result).toMatchObject({
      id: "loc_test",
      locationId: "loc_test",
      companyId: "company_test",
      accessToken: "access_new",
      refreshToken: "refresh_new",
      expiresAt: "2026-08-13T10:00:00.000Z"
    });
    expect(store.save).toHaveBeenCalledWith(result);
    expect(String(fetcher.mock.calls[0]?.[1]?.body)).toContain("refresh_token=refresh_old");
    expect(recordEvent).toHaveBeenCalledWith({
      installationId: "loc_test",
      name: "token_refreshed",
      result: "success"
    });
  });

  it("fails with a stable error when refresh is rejected", async () => {
    const store = fakeStore(expiredInstallation);

    await expect(
      getValidInstallation("loc_test", {
        store,
        fetcher: vi.fn(async () => new Response("unauthorized", { status: 401 })),
        now: () => new Date("2026-08-12T10:00:00.000Z"),
        oauthConfig: oauthConfig()
      })
    ).rejects.toThrow("HighLevel token refresh failed: 401");
  });
});

function oauthConfig() {
  return {
    clientId: "client_test",
    clientSecret: "secret_test",
    redirectUri: "https://paymatch.test/api/ghl/callback"
  };
}

function fakeStore(value: PayMatchInstallation): InstallationStore {
  return {
    get: vi.fn(async (id: string) => (id === value.id ? value : undefined)),
    save: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined)
  };
}
