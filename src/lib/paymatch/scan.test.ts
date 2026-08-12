import { describe, expect, it, vi } from "vitest";
import type { InstallationStore, PayMatchInstallation } from "@/lib/store/installations";
import { scanPayMatch } from "./scan";

const liveInstallation: PayMatchInstallation = {
  id: "loc_live",
  locationId: "loc_live",
  userType: "Location",
  accessToken: "access_live",
  refreshToken: "refresh_live",
  expiresAt: "2026-06-06T10:00:00.000Z",
  scopes: ["invoices.readonly"],
  createdAt: "2026-06-06T09:00:00.000Z",
  updatedAt: "2026-06-06T09:00:00.000Z"
};

describe("scanPayMatch", () => {
  it("uses fixture data when no installation is selected", async () => {
    const scan = await scanPayMatch({ from: "2026-05-01", to: "2026-05-31" });

    expect(scan.mode).toBe("fixture");
    expect(scan.locationId).toBe("demo-location");
    expect(scan.result.revenueAtRiskCents).toBeGreaterThan(0);
    expect(scan.csv.paidWithoutCharge).toContain("invoiceId");
  });

  it("uses the stored HighLevel token when installationId is present", async () => {
    const store: InstallationStore = {
      get: vi.fn(async (id: string) => (id === "loc_live" ? liveInstallation : undefined)),
      save: vi.fn(),
      delete: vi.fn()
    };
    const client = {
      listInvoices: vi.fn(async () => [
        {
          id: "inv_live",
          contactId: "contact_live",
          status: "paid",
          totalCents: 25000,
          currency: "USD",
          createdAt: "2026-05-10T10:00:00.000Z"
        }
      ]),
      listTransactions: vi.fn(async () => []),
      listSubscriptions: vi.fn(async () => []),
      listContacts: vi.fn(async () => [{ id: "contact_live", name: "Live Agency" }])
    };
    const recordEvent = vi.fn(async () => undefined);

    const scan = await scanPayMatch(
      { installationId: "loc_live", locationId: "ignored", from: "2026-05-01", to: "2026-05-31" },
      {
        store,
        clientFactory: () => client,
        getInstallation: vi.fn(async () => liveInstallation),
        recordEvent
      }
    );

    expect(scan.mode).toBe("live");
    expect(scan.locationId).toBe("loc_live");
    expect(client.listInvoices).toHaveBeenCalledWith("loc_live", { from: "2026-05-01", to: "2026-05-31" });
    expect(scan.result.tables.paidWithoutCharge).toHaveLength(1);
    expect(scan.result.tables.paidWithoutCharge[0]?.customerName).toBe("Live Agency");
    expect(recordEvent).toHaveBeenCalledWith(expect.objectContaining({ name: "scan_started", installationId: "loc_live" }));
    expect(recordEvent).toHaveBeenCalledWith(expect.objectContaining({ name: "scan_completed", installationId: "loc_live" }));
  });
});
