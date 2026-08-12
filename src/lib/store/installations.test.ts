import { afterEach, describe, expect, it, vi } from "vitest";
import { getInstallationStore, type PayMatchInstallation } from "./installations";

const installation: PayMatchInstallation = {
  id: "loc_test",
  locationId: "loc_test",
  userType: "Location",
  accessToken: "access_test",
  refreshToken: "refresh_test",
  expiresAt: "2026-08-13T10:00:00.000Z",
  scopes: ["invoices.readonly"],
  createdAt: "2026-08-12T10:00:00.000Z",
  updatedAt: "2026-08-12T10:00:00.000Z"
};

describe("getInstallationStore", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("rejects a production process without persistent storage", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "");

    expect(() => getInstallationStore()).toThrow("DATABASE_URL must be configured in production");
  });

  it("deletes an installation idempotently in memory outside production", async () => {
    const store = getInstallationStore({ environment: "test" });

    await store.save(installation);
    await store.delete(installation.id);
    await store.delete(installation.id);

    expect(await store.get(installation.id)).toBeUndefined();
  });
});
