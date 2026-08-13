import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { recordAffiliateClick } from "@/lib/affiliate/clicks";

vi.mock("@/lib/affiliate/clicks", () => ({
  recordAffiliateClick: vi.fn(async () => undefined)
}));

describe("GET /go/highlevel/[destination]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.HIGHLEVEL_AFFILIATE_LINKS_JSON = JSON.stringify({
      "starter:paymatch_content":
        "https://www.gohighlevel.com/pricing?fp_ref=radom-affiliate&fp_sid=paymatch_content"
    });
  });

  it("records the source and redirects to the verified affiliate link", async () => {
    const response = await GET(
      new Request("https://paymatch.example/go/highlevel/starter?source=paymatch_content"),
      { params: Promise.resolve({ destination: "starter" }) }
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://www.gohighlevel.com/pricing?fp_ref=radom-affiliate&fp_sid=paymatch_content"
    );
    expect(recordAffiliateClick).toHaveBeenCalledWith({
      destination: "starter",
      subId: "paymatch_content"
    });
  });

  it("rejects an unknown source instead of writing unbounded attribution data", async () => {
    const response = await GET(
      new Request("https://paymatch.example/go/highlevel/starter?source=untrusted"),
      { params: Promise.resolve({ destination: "starter" }) }
    );

    expect(response.status).toBe(400);
    expect(recordAffiliateClick).not.toHaveBeenCalled();
  });

  it("fails closed when no recovered affiliate link is configured", async () => {
    delete process.env.HIGHLEVEL_AFFILIATE_LINKS_JSON;

    const response = await GET(
      new Request("https://paymatch.example/go/highlevel/starter?source=paymatch_content"),
      { params: Promise.resolve({ destination: "starter" }) }
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("location")).toBeNull();
    expect(recordAffiliateClick).not.toHaveBeenCalled();
  });

  it("does not lose a verified referral when aggregate click storage is unavailable", async () => {
    vi.mocked(recordAffiliateClick).mockRejectedValueOnce(new Error("database unavailable"));

    const response = await GET(
      new Request("https://paymatch.example/go/highlevel/starter?source=paymatch_content"),
      { params: Promise.resolve({ destination: "starter" }) }
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("fp_sid=paymatch_content");
  });
});
