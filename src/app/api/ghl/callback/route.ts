import { NextResponse } from "next/server";
import { buildTokenExchangeRequest, type HighLevelTokenResponse, type HighLevelUserType } from "@/lib/ghl/oauth";
import { getInstallationStore, installationFromTokenResponse } from "@/lib/store/installations";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Missing authorization code." }, { status: 400 });
  }

  const clientId = process.env.GHL_CLIENT_ID;
  const clientSecret = process.env.GHL_CLIENT_SECRET;
  const redirectUri = process.env.GHL_REDIRECT_URI;
  const appBaseUrl = process.env.APP_BASE_URL ?? requestUrl.origin;
  const userType = (requestUrl.searchParams.get("userType") ?? "Location") as HighLevelUserType;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json({ error: "OAuth environment variables are not configured." }, { status: 500 });
  }

  const tokenRequest = buildTokenExchangeRequest({
    clientId,
    clientSecret,
    code,
    redirectUri,
    userType
  });
  const tokenResponse = await fetch(tokenRequest.url, tokenRequest.init);

  if (!tokenResponse.ok) {
    return NextResponse.json({ error: "Token exchange failed." }, { status: 502 });
  }

  const token = (await tokenResponse.json()) as HighLevelTokenResponse;
  const installation = installationFromTokenResponse(token);
  await getInstallationStore().save(installation);

  return NextResponse.redirect(`${appBaseUrl}/?connected=1&installationId=${encodeURIComponent(installation.id)}`);
}
