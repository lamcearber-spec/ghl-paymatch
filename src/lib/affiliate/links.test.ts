import { describe, expect, it } from "vitest";
import {
  affiliateUrl,
  parseAffiliateDestination,
  parseAffiliateSubId,
  type AffiliateLinkEnvironment
} from "./links";

const configuredLinks: AffiliateLinkEnvironment = {
  HIGHLEVEL_AFFILIATE_LINKS_JSON: JSON.stringify({
    "starter:paymatch_content":
      "https://www.gohighlevel.com/pricing?fp_ref=radom-affiliate&fp_sid=paymatch_content",
    "unlimited:organic_search":
      "https://www.gohighlevel.com/pricing?fpr=radom-affiliate&fp_sid=organic_search"
  })
};

describe("affiliateUrl", () => {
  it("returns the exact portal-generated link for an allowlisted destination and SubID", () => {
    expect(affiliateUrl("starter", "paymatch_content", configuredLinks)).toBe(
      "https://www.gohighlevel.com/pricing?fp_ref=radom-affiliate&fp_sid=paymatch_content"
    );
  });

  it("accepts FirstPromoter links that use the fpr referral parameter", () => {
    expect(affiliateUrl("unlimited", "organic_search", configuredLinks)).toContain(
      "fpr=radom-affiliate&fp_sid=organic_search"
    );
  });

  it.each([
    ["http://www.gohighlevel.com/pricing?fp_ref=radom&fp_sid=paymatch_content", "HTTPS"],
    ["https://gohighlevel.example/pricing?fp_ref=radom&fp_sid=paymatch_content", "HighLevel"],
    ["https://www.gohighlevel.com/pricing?fp_sid=paymatch_content", "referral token"],
    ["https://www.gohighlevel.com/pricing?fp_ref=radom&fp_sid=email", "SubID"]
  ])("rejects a malformed configured destination", (url, message) => {
    const env = {
      HIGHLEVEL_AFFILIATE_LINKS_JSON: JSON.stringify({ "starter:paymatch_content": url })
    };

    expect(() => affiliateUrl("starter", "paymatch_content", env)).toThrow(message);
  });

  it("fails closed when the verified portal link has not been configured", () => {
    expect(() => affiliateUrl("pro", "email", {})).toThrow(/not configured/i);
  });
});

describe("affiliate route values", () => {
  it("rejects unknown destinations", () => {
    expect(parseAffiliateDestination("enterprise")).toBeUndefined();
  });

  it("rejects unknown SubIDs", () => {
    expect(parseAffiliateSubId("untrusted_campaign")).toBeUndefined();
  });
});
