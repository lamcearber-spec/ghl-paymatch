import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
});
