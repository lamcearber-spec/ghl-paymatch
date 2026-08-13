import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import HighLevelForAgenciesPage from "./page";

afterEach(() => {
  delete process.env.HIGHLEVEL_AFFILIATE_LINKS_JSON;
});

describe("HighLevelForAgenciesPage", () => {
  it("publishes a useful plan comparison with a conspicuous affiliate disclosure", async () => {
    process.env.HIGHLEVEL_AFFILIATE_LINKS_JSON = JSON.stringify({
      "starter:organic_search":
        "https://www.gohighlevel.com/pricing?fp_ref=radom-affiliate&fp_sid=organic_search",
      "unlimited:organic_search":
        "https://www.gohighlevel.com/pricing?fp_ref=radom-affiliate&fp_sid=organic_search",
      "pro:organic_search":
        "https://www.gohighlevel.com/pricing?fp_ref=radom-affiliate&fp_sid=organic_search"
    });

    render(await HighLevelForAgenciesPage());

    expect(screen.getByRole("heading", { name: /highlevel for agencies/i })).toBeInTheDocument();
    expect(screen.getByText(/affiliate disclosure/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^starter$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^unlimited$/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /agency pro/i })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /start with highlevel/i })).toHaveLength(3);
    expect(screen.getAllByRole("link", { name: /start with highlevel/i })[0]).toHaveAttribute(
      "href",
      "/go/highlevel/starter?source=organic_search"
    );
  });

  it("does not show a referral CTA to an installed HighLevel customer", async () => {
    process.env.HIGHLEVEL_AFFILIATE_LINKS_JSON = JSON.stringify({
      "starter:organic_search":
        "https://www.gohighlevel.com/pricing?fp_ref=radom-affiliate&fp_sid=organic_search"
    });

    render(
      await HighLevelForAgenciesPage({
        searchParams: Promise.resolve({ session: "opaque-installation-session" })
      })
    );

    expect(screen.queryByRole("link", { name: /start with highlevel/i })).not.toBeInTheDocument();
    expect(screen.getByText(/manage your existing subscription inside highlevel/i)).toBeInTheDocument();
  });

  it("does not expose a direct signup link while the verified affiliate link is unavailable", async () => {
    render(await HighLevelForAgenciesPage());

    expect(screen.queryByRole("link", { name: /start with highlevel/i })).not.toBeInTheDocument();
    expect(screen.getByText(/referral link is temporarily unavailable/i)).toBeInTheDocument();
  });

  it("preserves an allowlisted content source through the plan links", async () => {
    process.env.HIGHLEVEL_AFFILIATE_LINKS_JSON = JSON.stringify({
      "starter:paymatch_content":
        "https://www.gohighlevel.com/pricing?fp_ref=radom-affiliate&fp_sid=paymatch_content"
    });

    render(
      await HighLevelForAgenciesPage({
        searchParams: Promise.resolve({ source: "paymatch_content" })
      })
    );

    expect(screen.getByRole("link", { name: /start with highlevel/i })).toHaveAttribute(
      "href",
      "/go/highlevel/starter?source=paymatch_content"
    );
  });
});
