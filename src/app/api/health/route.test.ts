import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

describe("GET /api/health", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns 503 without exposing configured values when dependencies are missing", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("INSTALLATION_SECRET", "");
    vi.stubEnv("GHL_CLIENT_ID", "");
    vi.stubEnv("GHL_CLIENT_SECRET", "");
    vi.stubEnv("GHL_REDIRECT_URI", "");

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({
      status: "degraded",
      checks: { application: true, database: false, oauth: false, tokenEncryption: false }
    });
    expect(JSON.stringify(payload)).not.toContain("secret");
  });
});
