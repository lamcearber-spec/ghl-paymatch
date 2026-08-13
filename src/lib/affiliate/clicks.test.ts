import { describe, expect, it, vi } from "vitest";
import { recordAffiliateClick, type AffiliateClickStore } from "./clicks";

describe("recordAffiliateClick", () => {
  it("stores only the destination, allowlisted SubID, and timestamp", async () => {
    const store: AffiliateClickStore = { write: vi.fn(async () => undefined) };

    await recordAffiliateClick(
      { destination: "starter", subId: "paymatch_content" },
      { store, now: () => new Date("2026-08-13T12:00:00.000Z") }
    );

    expect(store.write).toHaveBeenCalledWith({
      destination: "starter",
      subId: "paymatch_content",
      occurredAt: "2026-08-13T12:00:00.000Z"
    });
  });
});
