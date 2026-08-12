import { describe, expect, it, vi } from "vitest";
import type { AppEvent } from "@/lib/observability/events";
import type { InstallationStore } from "@/lib/store/installations";
import { handleOAuthCallback } from "./route";

describe("GET /api/ghl/callback", () => {
  it("persists the installation and records a successful install", async () => {
    const store = fakeStore();
    const recordEvent = vi.fn(async (_event: AppEvent) => undefined);
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          access_token: "access_test",
          refresh_token: "refresh_test",
          token_type: "Bearer",
          expires_in: 86400,
          locationId: "loc_test",
          userType: "Location",
          scope: "invoices.readonly"
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const response = await handleOAuthCallback(
      new Request("https://paymatch.test/api/ghl/callback?code=code_test&userType=Location"),
      {
        store,
        fetcher,
        recordEvent,
        config: {
          clientId: "client_test",
          clientSecret: "secret_test",
          redirectUri: "https://paymatch.test/api/ghl/callback",
          appBaseUrl: "https://paymatch.test"
        }
      }
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://paymatch.test/?connected=1&installationId=loc_test");
    expect(store.save).toHaveBeenCalledOnce();
    expect(recordEvent).toHaveBeenCalledWith({ installationId: "loc_test", name: "install_completed", result: "success" });
  });

  it("records a stable failure event when HighLevel rejects the exchange", async () => {
    const recordEvent = vi.fn(async (_event: AppEvent) => undefined);
    const response = await handleOAuthCallback(
      new Request("https://paymatch.test/api/ghl/callback?code=bad_code"),
      {
        store: fakeStore(),
        fetcher: vi.fn(async () => new Response("bad code", { status: 401 })),
        recordEvent,
        config: {
          clientId: "client_test",
          clientSecret: "secret_test",
          redirectUri: "https://paymatch.test/api/ghl/callback",
          appBaseUrl: "https://paymatch.test"
        }
      }
    );

    expect(response.status).toBe(502);
    expect(recordEvent).toHaveBeenCalledWith({
      installationId: "oauth_callback",
      name: "install_failed",
      result: "failure",
      errorCode: "token_exchange_401"
    });
  });
});

function fakeStore(): InstallationStore {
  return {
    get: vi.fn(),
    save: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined)
  };
}
