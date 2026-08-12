import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PayMatchDashboard } from "./PayMatchDashboard";
import { demoPayMatchResult } from "@/lib/reconcile/fixtures";

describe("PayMatchDashboard", () => {
  it("renders the month-end revenue tie-out with all discrepancy tables and CSV exports", () => {
    render(<PayMatchDashboard result={demoPayMatchResult} mode="fixture" />);

    expect(screen.getByRole("heading", { name: /paymatch/i })).toBeInTheDocument();
    expect(screen.getByText("Revenue at risk")).toBeInTheDocument();
    expect(screen.getByText("$165.00")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /paid invoices without captured charge/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /captured charges without closed invoice/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /active subscriptions with failed latest payment/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /linked amount or currency mismatch/i })).toBeInTheDocument();
    expect(screen.getAllByText("review").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /download csv/i })).toHaveLength(4);
  });

  it("labels a partial scan and shows source coverage warnings", () => {
    render(
      <PayMatchDashboard
        result={{
          ...demoPayMatchResult,
          summary: {
            ...demoPayMatchResult.summary,
            paginationComplete: false,
            warnings: ["Invoices: HighLevel stopped responding after page 1; this source is partial."],
            sourceCompleteness: {
              ...demoPayMatchResult.summary.sourceCompleteness,
              invoices: { complete: false, pagesRead: 1, reportedTotal: 200 }
            }
          }
        }}
        mode="live"
      />
    );

    expect(screen.getByText("Partial scan")).toBeInTheDocument();
    expect(screen.getByText(/invoices: highlevel stopped responding/i)).toBeInTheDocument();
    expect(screen.getByText(/invoices fetched/i)).toBeInTheDocument();
  });

  it("shows the native marketplace upgrade after the free scan is consumed", () => {
    render(
      <PayMatchDashboard
        result={demoPayMatchResult}
        mode="live"
        entitlement={{ plan: "free", locationLimit: 1, scansRemaining: 0 }}
        marketplaceUrl="https://marketplace.gohighlevel.com/integration/app_paymatch"
      />
    );

    expect(screen.getByText(/free scan is complete/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view paymatch plans/i })).toHaveAttribute(
      "href",
      "https://marketplace.gohighlevel.com/integration/app_paymatch"
    );
  });

  it("shows why a record was flagged and the next manual check", () => {
    render(<PayMatchDashboard result={demoPayMatchResult} mode="fixture" />);

    expect(screen.getAllByText(/invoice is marked paid/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/open the invoice and confirm/i).length).toBeGreaterThan(0);
  });

  it("records CSV exports through an authenticated server event", () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<PayMatchDashboard result={demoPayMatchResult} mode="live" session="opaque_session" />);

    const exportLink = screen.getAllByRole("link", { name: /download csv/i })[0];
    exportLink.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(exportLink);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/events/export",
      expect.objectContaining({
        method: "POST",
        keepalive: true,
        body: JSON.stringify({
          session: "opaque_session",
          exportName: "paymatch-paid-without-charge.csv"
        })
      })
    );
    vi.unstubAllGlobals();
  });
});
