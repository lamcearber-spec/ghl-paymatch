import { describe, expect, it, vi } from "vitest";
import type { InstallationStore, PayMatchInstallation } from "@/lib/store/installations";
import { provisionLocationInstallation } from "./provision-location";

const agencyInstallation: PayMatchInstallation = {
  id: "company_1",
  companyId: "company_1",
  userType: "Company",
  accessToken: "agency_access",
  refreshToken: "agency_refresh",
  expiresAt: "2026-08-14T10:00:00.000Z",
  scopes: ["oauth.write"],
  createdAt: "2026-08-13T10:00:00.000Z",
  updatedAt: "2026-08-13T10:00:00.000Z"
};

describe("provisionLocationInstallation", () => {
  it("exchanges a valid agency token and persists the installed location", async () => {
    const store = fakeStore(agencyInstallation);
    const recordEvent = vi.fn(async () => undefined);
    const fetcher = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify({
          access_token: "location_access",
          refresh_token: "location_refresh",
          token_type: "Bearer",
          expires_in: 86400,
          scope: "invoices.readonly payments/transactions.readonly oauth.write",
          userType: "Location",
          locationId: "loc_1",
          companyId: "company_1"
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const installation = await provisionLocationInstallation(
      { companyId: "company_1", locationId: "loc_1" },
      {
        store,
        fetcher,
        now: () => new Date("2026-08-13T10:00:00.000Z"),
        oauthConfig: {
          clientId: "client_test",
          clientSecret: "secret_test",
          redirectUri: "https://paymatch.test/api/ghl/callback"
        },
        recordEvent
      }
    );

    expect(installation).toMatchObject({
      id: "loc_1",
      locationId: "loc_1",
      companyId: "company_1",
      userType: "Location",
      accessToken: "location_access"
    });
    expect(store.save).toHaveBeenCalledWith(installation);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const request = fetcher.mock.calls[0];
    expect(request?.[0]).toBe("https://services.leadconnectorhq.com/oauth/location-token");
    expect(new Headers(request?.[1]?.headers).get("Version")).toBe("v3");
    expect(String(request?.[1]?.body)).toContain("locationId=loc_1");
    expect(recordEvent).toHaveBeenCalledWith({
      installationId: "loc_1",
      name: "install_completed",
      result: "success"
    });
  });
});

function fakeStore(agency: PayMatchInstallation): InstallationStore {
  return {
    get: vi.fn(async (id: string) => (id === agency.id ? agency : undefined)),
    save: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined)
  };
}
