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

  it("renders fixture data in production without initializing live storage", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "");

    try {
      await expect(scanPayMatch()).resolves.toMatchObject({ mode: "fixture", locationId: "demo-location" });
    } finally {
      vi.unstubAllEnvs();
    }
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
        reserveScan: vi.fn(async () => ({ allowed: true, consumedFreeScan: false })),
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

  it("stops before HighLevel API reads when the free scan is exhausted", async () => {
    const getInstallation = vi.fn(async () => liveInstallation);
    const clientFactory = vi.fn();

    await expect(
      scanPayMatch(
        { installationId: "loc_live" },
        {
          store: fakeInstallationStore(),
          reserveScan: vi.fn(async () => ({ allowed: false, consumedFreeScan: false })),
          getInstallation,
          clientFactory
        }
      )
    ).rejects.toMatchObject({ name: "ScanLimitExceededError" });

    expect(getInstallation).not.toHaveBeenCalled();
    expect(clientFactory).not.toHaveBeenCalled();
  });

  it("returns a reserved free scan when a live read fails", async () => {
    const releaseScan = vi.fn(async () => undefined);
    const client = {
      listInvoices: vi.fn(async () => {
        throw new Error("HighLevel request failed: 503");
      }),
      listTransactions: vi.fn(async () => []),
      listSubscriptions: vi.fn(async () => []),
      listContacts: vi.fn(async () => [])
    };

    await expect(
      scanPayMatch(
        { installationId: "loc_live" },
        {
          store: fakeInstallationStore(),
          reserveScan: vi.fn(async () => ({ allowed: true, consumedFreeScan: true })),
          releaseScan,
          getInstallation: vi.fn(async () => liveInstallation),
          clientFactory: () => client
        }
      )
    ).rejects.toThrow("HighLevel request failed: 503");

    expect(releaseScan).toHaveBeenCalledWith("loc_live");
  });

  it("does not release a paid scan after a live read failure", async () => {
    const releaseScan = vi.fn(async () => undefined);
    const client = {
      listInvoices: vi.fn(async () => {
        throw new Error("HighLevel request failed: 503");
      }),
      listTransactions: vi.fn(async () => []),
      listSubscriptions: vi.fn(async () => []),
      listContacts: vi.fn(async () => [])
    };

    await expect(
      scanPayMatch(
        { installationId: "loc_live" },
        {
          store: fakeInstallationStore(),
          reserveScan: vi.fn(async () => ({ allowed: true, consumedFreeScan: false })),
          releaseScan,
          getInstallation: vi.fn(async () => liveInstallation),
          clientFactory: () => client
        }
      )
    ).rejects.toThrow("HighLevel request failed: 503");

    expect(releaseScan).not.toHaveBeenCalled();
  });

  it("carries source completeness and product counts into the report", async () => {
    const complete = { complete: true, pagesRead: 1, reportedTotal: 0 };
    const client = {
      listInvoices: vi.fn(async () => []),
      listTransactions: vi.fn(async () => []),
      listSubscriptions: vi.fn(async () => []),
      listContacts: vi.fn(async () => []),
      readInvoices: vi.fn(async () => ({
        records: [],
        completeness: {
          complete: false,
          pagesRead: 1,
          reportedTotal: 200,
          warning: "HighLevel stopped responding after page 1; this source is partial."
        }
      })),
      readTransactions: vi.fn(async () => ({ records: [], completeness: complete })),
      readSubscriptions: vi.fn(async () => ({ records: [], completeness: complete })),
      readContacts: vi.fn(async () => ({ records: [], completeness: complete })),
      readProducts: vi.fn(async () => ({
        records: [{ id: "product_1", name: "Retainer" }],
        completeness: { complete: true, pagesRead: 1, reportedTotal: 1 }
      }))
    };

    const scan = await scanPayMatch(
      { installationId: "loc_live" },
      {
        store: fakeInstallationStore(),
        reserveScan: vi.fn(async () => ({ allowed: true, consumedFreeScan: false })),
        getInstallation: vi.fn(async () => liveInstallation),
        clientFactory: () => client
      }
    );

    expect(client.readProducts).toHaveBeenCalledWith("loc_live");
    expect(scan.result.summary.sourceCounts.products).toBe(1);
    expect(scan.result.summary.paginationComplete).toBe(false);
    expect(scan.result.summary.warnings[0]).toMatch(/^Invoices:/);
    expect(scan.csv.paidWithoutCharge).toMatch(/^invoiceId,invoiceNumber,customerName/);
  });
});

function fakeInstallationStore(): InstallationStore {
  return {
    get: vi.fn(),
    save: vi.fn(),
    delete: vi.fn()
  };
}
