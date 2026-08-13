export const AFFILIATE_DESTINATIONS = ["starter", "unlimited", "pro"] as const;
export const AFFILIATE_SUB_IDS = [
  "paymatch_content",
  "inboxguard_content",
  "accesslens_content",
  "organic_search",
  "email",
  "direct_cross_sell"
] as const;

export type AffiliateDestination = (typeof AFFILIATE_DESTINATIONS)[number];
export type AffiliateSubId = (typeof AFFILIATE_SUB_IDS)[number];

export type AffiliateLinkEnvironment = {
  HIGHLEVEL_AFFILIATE_LINKS_JSON?: string;
};

export function parseAffiliateDestination(value: string | null | undefined): AffiliateDestination | undefined {
  return AFFILIATE_DESTINATIONS.find((destination) => destination === value);
}

export function parseAffiliateSubId(value: string | null | undefined): AffiliateSubId | undefined {
  return AFFILIATE_SUB_IDS.find((subId) => subId === value);
}

export function affiliateUrl(
  destination: AffiliateDestination,
  subId: AffiliateSubId,
  environment: AffiliateLinkEnvironment = {
    HIGHLEVEL_AFFILIATE_LINKS_JSON: process.env.HIGHLEVEL_AFFILIATE_LINKS_JSON
  }
): string {
  const configured = parseConfiguredLinks(environment.HIGHLEVEL_AFFILIATE_LINKS_JSON);
  const value = configured[`${destination}:${subId}`];

  if (!value) {
    throw new Error(`Verified HighLevel affiliate link is not configured for ${destination}:${subId}.`);
  }

  validateAffiliateUrl(value, subId);
  return value;
}

function parseConfiguredLinks(raw: string | undefined): Record<string, string> {
  if (!raw) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("HIGHLEVEL_AFFILIATE_LINKS_JSON must contain valid JSON.");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("HIGHLEVEL_AFFILIATE_LINKS_JSON must contain an object.");
  }

  return Object.fromEntries(
    Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string")
  );
}

function validateAffiliateUrl(value: string, subId: AffiliateSubId): void {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Configured HighLevel affiliate link is not a valid URL.");
  }

  if (url.protocol !== "https:") {
    throw new Error("Configured HighLevel affiliate link must use HTTPS.");
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname !== "gohighlevel.com" && !hostname.endsWith(".gohighlevel.com")) {
    throw new Error("Configured affiliate link must use an official HighLevel hostname.");
  }

  if (url.username || url.password) {
    throw new Error("Configured HighLevel affiliate link must not contain credentials.");
  }

  if (!url.searchParams.get("fp_ref") && !url.searchParams.get("fpr")) {
    throw new Error("Configured HighLevel affiliate link is missing its referral token.");
  }

  if (url.searchParams.get("fp_sid") !== subId) {
    throw new Error("Configured HighLevel affiliate link has the wrong SubID.");
  }
}
