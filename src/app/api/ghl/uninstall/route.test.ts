import { describe, expect, it, vi } from "vitest";
import type { AppEvent } from "@/lib/observability/events";
import type { InstallationStore } from "@/lib/store/installations";
import { handleUninstall } from "./route";

describe("POST /api/ghl/uninstall", () => {
  it("rejects an unsigned uninstall", async () => {
    const response = await handleUninstall(uninstallRequest(), {
      store: fakeStore(),
      verifySignature: () => false,
      recordEvent: vi.fn()
    });

    expect(response.status).toBe(401);
  });

  it("deletes the installation idempotently after signature and app validation", async () => {
    const store = fakeStore();
    const recordEvent = vi.fn(async (_event: AppEvent) => undefined);
    const response = await handleUninstall(uninstallRequest(), {
      store,
      verifySignature: () => true,
      recordEvent,
      expectedAppId: "app_test"
    });

    expect(response.status).toBe(200);
    expect(store.delete).toHaveBeenCalledWith("loc_test");
    expect(recordEvent).toHaveBeenCalledWith({ installationId: "loc_test", name: "uninstalled", result: "success" });
  });
});

function uninstallRequest(): Request {
  return new Request("https://paymatch.test/api/ghl/uninstall", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-GHL-Signature": "signature" },
    body: JSON.stringify({ type: "UNINSTALL", appId: "app_test", locationId: "loc_test" })
  });
}

function fakeStore(): InstallationStore {
  return {
    get: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(async () => undefined)
  };
}
