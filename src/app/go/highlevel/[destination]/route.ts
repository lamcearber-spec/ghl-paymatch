import { NextResponse } from "next/server";
import { recordAffiliateClick } from "@/lib/affiliate/clicks";
import {
  affiliateUrl,
  parseAffiliateDestination,
  parseAffiliateSubId
} from "@/lib/affiliate/links";

export async function GET(
  request: Request,
  context: { params: Promise<{ destination: string }> }
): Promise<Response> {
  const destination = parseAffiliateDestination((await context.params).destination);
  const subId = parseAffiliateSubId(new URL(request.url).searchParams.get("source"));

  if (!destination || !subId) {
    return NextResponse.json({ error: "Unknown affiliate destination or source." }, { status: 400 });
  }

  let destinationUrl: string;
  try {
    destinationUrl = affiliateUrl(destination, subId);
  } catch {
    return NextResponse.json({ error: "Verified referral link is unavailable." }, { status: 503 });
  }

  try {
    await recordAffiliateClick({ destination, subId });
  } catch (error) {
    console.error("Affiliate click could not be recorded.", error);
  }

  return NextResponse.redirect(destinationUrl, 307);
}
