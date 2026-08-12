import { describe, expect, it, vi } from "vitest";
import { recordAppEvent, type AppEventStore } from "./events";

describe("recordAppEvent", () => {
  it("stores a keyed installation hash instead of the HighLevel id", async () => {
    const store: AppEventStore = { write: vi.fn(async () => undefined) };

    await recordAppEvent(
      {
        installationId: "loc_private",
        name: "scan_completed",
        result: "success",
        durationMs: 321
      },
      { store, hashingSecret: "a sufficiently long event hashing secret" }
    );

    expect(store.write).toHaveBeenCalledOnce();
    const stored = vi.mocked(store.write).mock.calls[0]?.[0];
    expect(stored?.installationHash).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(stored)).not.toContain("loc_private");
    expect(stored).toMatchObject({ name: "scan_completed", result: "success", durationMs: 321 });
  });
});
