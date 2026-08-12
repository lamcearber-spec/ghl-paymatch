import { describe, expect, it, vi } from "vitest";
import { handleExportEvent } from "./route";
import { readInstallationSession } from "@/lib/security/installation-session";

vi.mock("@/lib/security/installation-session", () => ({
  readInstallationSession: vi.fn((session: string) => {
    if (session !== "valid_session") {
      throw new Error("invalid");
    }
    return "loc_private";
  })
}));

describe("POST /api/events/export", () => {
  it("records an authenticated export without storing the session or record payload", async () => {
    const recordEvent = vi.fn(async () => undefined);
    const response = await handleExportEvent(
      new Request("https://paymatch.test/api/events/export", {
        method: "POST",
        body: JSON.stringify({
          session: "valid_session",
          exportName: "paymatch-paid-without-charge.csv"
        })
      }),
      { recordEvent }
    );

    expect(response.status).toBe(202);
    expect(recordEvent).toHaveBeenCalledWith({
      installationId: "loc_private",
      name: "export_completed",
      result: "success"
    });
    expect(JSON.stringify(vi.mocked(recordEvent).mock.calls)).not.toContain("valid_session");
  });

  it("rejects a tampered session before recording an event", async () => {
    vi.mocked(readInstallationSession).mockImplementationOnce(() => {
      throw new Error("invalid");
    });
    const recordEvent = vi.fn(async () => undefined);
    const response = await handleExportEvent(
      new Request("https://paymatch.test/api/events/export", {
        method: "POST",
        body: JSON.stringify({ session: "tampered", exportName: "paymatch-paid-without-charge.csv" })
      }),
      { recordEvent }
    );

    expect(response.status).toBe(401);
    expect(recordEvent).not.toHaveBeenCalled();
  });

  it("rejects unknown export names", async () => {
    const recordEvent = vi.fn(async () => undefined);
    const response = await handleExportEvent(
      new Request("https://paymatch.test/api/events/export", {
        method: "POST",
        body: JSON.stringify({ session: "valid_session", exportName: "customer-records.json" })
      }),
      { recordEvent }
    );

    expect(response.status).toBe(400);
    expect(recordEvent).not.toHaveBeenCalled();
  });
});
