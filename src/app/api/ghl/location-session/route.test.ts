import { describe, expect, it, vi } from "vitest";
import type { InstallationStore, PayMatchInstallation } from "@/lib/store/installations";
import { handleLocationSession } from "./route";

const company: PayMatchInstallation = {
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

const location: PayMatchInstallation = {
  ...company,
  id: "loc_1",
  locationId: "loc_1",
  userType: "Location",
  accessToken: "location_access",
  refreshToken: "location_refresh"
};

describe("POST /api/ghl/location-session", () => {
  it("upgrades an authenticated agency session to its installed location", async () => {
    const store = fakeStore([company, location]);
    const provisionLocation = vi.fn(async () => location);
    const response = await handleLocationSession(locationSessionRequest(), {
      store,
      readSession: () => "company_1",
      createSession: (id) => `session_for_${id}`,
      provisionLocation
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ session: "session_for_loc_1" });
    expect(provisionLocation).not.toHaveBeenCalled();
  });

  it("provisions a missing location before issuing its session", async () => {
    const store = fakeStore([company]);
    const provisionLocation = vi.fn(async () => location);
    const response = await handleLocationSession(locationSessionRequest(), {
      store,
      readSession: () => "company_1",
      createSession: (id) => `session_for_${id}`,
      provisionLocation
    });

    expect(response.status).toBe(200);
    expect(provisionLocation).toHaveBeenCalledWith({ companyId: "company_1", locationId: "loc_1" });
  });

  it("rejects a location outside the authenticated company", async () => {
    const store = fakeStore([{ ...company, id: "other_company", companyId: "other_company" }, location]);
    const response = await handleLocationSession(locationSessionRequest(), {
      store,
      readSession: () => "other_company",
      createSession: vi.fn(),
      provisionLocation: vi.fn()
    });

    expect(response.status).toBe(403);
  });
});

function locationSessionRequest(): Request {
  return new Request("https://paymatch.test/api/ghl/location-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session: "agency_session", locationId: "loc_1" })
  });
}

function fakeStore(installations: PayMatchInstallation[]): InstallationStore {
  return {
    get: vi.fn(async (id: string) => installations.find((installation) => installation.id === id)),
    save: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined)
  };
}
