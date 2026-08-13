import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "./page";
import { scanPayMatch } from "@/lib/paymatch/scan";
import { getPayMatchEntitlement } from "@/lib/billing/entitlements";
import { TokenRefreshError } from "@/lib/ghl/session";
import { readInstallationSession } from "@/lib/security/installation-session";

vi.mock("@/lib/paymatch/scan", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/paymatch/scan")>();
  return {
    ...actual,
    scanPayMatch: vi.fn(async (params: Record<string, string | undefined>) => ({
    mode: params.installationId ? "live" : "fixture",
    locationId: params.locationId ?? "demo-location",
    result: {
      dateRange: {
        from: params.from ?? "2026-05-01",
        to: params.to ?? "2026-05-31"
      },
      revenueAtRiskCents: 0,
      currency: "USD",
      summary: {
        sourceCounts: { invoices: 0, transactions: 0, subscriptions: 0, contacts: 0, products: 0 },
        matchCounts: { exact: 0, review: 0 },
        findingCounts: {
          paidWithoutCharge: 0,
          chargeWithoutInvoice: 0,
          activeSubFailedPayment: 0,
          amountCurrencyMismatch: 0
        },
        paginationComplete: true,
        sourceCompleteness: {
          invoices: { complete: true, pagesRead: 0 },
          transactions: { complete: true, pagesRead: 0 },
          subscriptions: { complete: true, pagesRead: 0 },
          contacts: { complete: true, pagesRead: 0 },
          products: { complete: true, pagesRead: 0 }
        },
        warnings: []
      },
      tables: {
        paidWithoutCharge: [],
        chargeWithoutInvoice: [],
        activeSubFailedPayment: [],
        amountCurrencyMismatch: []
      }
    },
    csv: {
      paidWithoutCharge: "",
      chargeWithoutInvoice: "",
      activeSubFailedPayment: "",
      amountCurrencyMismatch: ""
    }
    }))
  };
});

vi.mock("@/lib/billing/entitlements", () => ({
  getPayMatchEntitlement: vi.fn(async () => ({ plan: "free", locationLimit: 1, scansRemaining: 0 }))
}));

vi.mock("@/lib/security/installation-session", () => ({
  readInstallationSession: vi.fn((session: string) => session === "valid_session" ? "loc_live" : (() => { throw new Error("Installation session is invalid."); })())
}));

describe("Home", () => {
  it("passes marketplace redirect search params into the PayMatch scan", async () => {
    const element = await Home({
      searchParams: Promise.resolve({
        session: "valid_session",
        locationId: "loc_query",
        from: "2026-05-01",
        to: "2026-05-31",
        scan: "1"
      })
    });

    render(element);

    expect(scanPayMatch).toHaveBeenCalledWith({
      installationId: "loc_live",
      locationId: "loc_query",
      from: "2026-05-01",
      to: "2026-05-31"
    });
    expect(screen.getByText("Live scan")).toBeInTheDocument();
    expect(getPayMatchEntitlement).toHaveBeenCalledWith("loc_live");
  });

  it("does not run another scan when a connected page is refreshed without the scan marker", async () => {
    vi.mocked(scanPayMatch).mockClear();
    vi.mocked(getPayMatchEntitlement).mockResolvedValueOnce({ plan: "free", locationLimit: 1, scansRemaining: 0 });

    const element = await Home({
      searchParams: Promise.resolve({ session: "valid_session" })
    });

    render(element);

    expect(scanPayMatch).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: /ready for another scan/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view paymatch plans/i })).toBeInTheDocument();
  });

  it("shows a reconnect action when HighLevel rejects token refresh", async () => {
    vi.mocked(scanPayMatch).mockRejectedValueOnce(new TokenRefreshError(401));

    const element = await Home({
      searchParams: Promise.resolve({ session: "valid_session", scan: "1" })
    });

    render(element);

    expect(screen.getByRole("heading", { name: /reconnect paymatch/i })).toBeInTheDocument();
    expect(screen.getByText(/highlevel authorization has expired/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open paymatch in marketplace/i })).toBeInTheDocument();
  });

  it("rejects a tampered installation session before scanning", async () => {
    vi.mocked(scanPayMatch).mockClear();
    vi.mocked(readInstallationSession).mockImplementationOnce(() => {
      throw new Error("Installation session is invalid.");
    });

    const element = await Home({ searchParams: Promise.resolve({ session: "tampered", scan: "1" }) });
    render(element);

    expect(scanPayMatch).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: /reconnect paymatch/i })).toBeInTheDocument();
  });

  it("shows a safe retry action when a live HighLevel read fails", async () => {
    vi.mocked(scanPayMatch).mockRejectedValueOnce(new Error("HighLevel request failed: 422"));

    const element = await Home({ searchParams: Promise.resolve({ session: "valid_session", scan: "1" }) });
    render(element);

    expect(screen.getByRole("heading", { name: /scan could not complete/i })).toBeInTheDocument();
    expect(screen.getByText(/was not counted/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /try the scan again/i })).toHaveAttribute(
      "href",
      "/?session=valid_session&scan=1"
    );
  });
});
