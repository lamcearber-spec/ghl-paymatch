import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import Home from "./page";
import { scanPayMatch } from "@/lib/paymatch/scan";

vi.mock("@/lib/paymatch/scan", () => ({
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
}));

describe("Home", () => {
  it("passes marketplace redirect search params into the PayMatch scan", async () => {
    const element = await Home({
      searchParams: Promise.resolve({
        installationId: "loc_live",
        locationId: "loc_query",
        from: "2026-05-01",
        to: "2026-05-31"
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
  });
});
