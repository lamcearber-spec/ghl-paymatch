import { NextResponse } from "next/server";
import { buildTokenExchangeRequest, type HighLevelTokenResponse, type HighLevelUserType } from "@/lib/ghl/oauth";
import { getInstallationStore, installationFromTokenResponse } from "@/lib/store/installations";
import type { InstallationStore } from "@/lib/store/installations";
import { recordAppEvent, type AppEvent } from "@/lib/observability/events";
import { createInstallationSession } from "@/lib/security/installation-session";

type CallbackConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  appBaseUrl: string;
};

type CallbackDependencies = {
  store?: InstallationStore;
  fetcher?: typeof fetch;
  recordEvent?: (event: AppEvent) => Promise<void>;
  config?: CallbackConfig;
  sessionSecret?: string;
};

export async function GET(request: Request) {
  return handleOAuthCallback(request);
}

export async function handleOAuthCallback(request: Request, deps: CallbackDependencies = {}) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Missing authorization code." }, { status: 400 });
  }

  const config = deps.config ?? callbackConfigFromEnvironment(requestUrl.origin);
  const rawUserType = requestUrl.searchParams.get("userType") ?? "Location";
  const userType: HighLevelUserType = rawUserType === "Company" ? "Company" : "Location";

  if (!config) {
    return NextResponse.json({ error: "OAuth environment variables are not configured." }, { status: 500 });
  }

  const tokenRequest = buildTokenExchangeRequest({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    code,
    redirectUri: config.redirectUri,
    userType
  });
  const tokenResponse = await (deps.fetcher ?? fetch)(tokenRequest.url, tokenRequest.init);

  if (!tokenResponse.ok) {
    await safeRecordEvent(deps.recordEvent ?? recordAppEvent, {
      installationId: "oauth_callback",
      name: "install_failed",
      result: "failure",
      errorCode: `token_exchange_${tokenResponse.status}`
    });
    return NextResponse.json({ error: "Token exchange failed." }, { status: 502 });
  }

  const token = (await tokenResponse.json()) as HighLevelTokenResponse;
  const installation = installationFromTokenResponse(token);
  await (deps.store ?? getInstallationStore()).save(installation);
  await safeRecordEvent(deps.recordEvent ?? recordAppEvent, {
    installationId: installation.id,
    name: "install_completed",
    result: "success"
  });

  const session = createInstallationSession(installation.id, { secret: deps.sessionSecret });
  return NextResponse.redirect(`${config.appBaseUrl}/?connected=1&session=${encodeURIComponent(session)}&scan=1`);
}

function callbackConfigFromEnvironment(origin: string): CallbackConfig | undefined {
  const clientId = process.env.GHL_CLIENT_ID;
  const clientSecret = process.env.GHL_CLIENT_SECRET;
  const redirectUri = process.env.GHL_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return undefined;
  }
  return { clientId, clientSecret, redirectUri, appBaseUrl: process.env.APP_BASE_URL ?? origin };
}

async function safeRecordEvent(recorder: (event: AppEvent) => Promise<void>, event: AppEvent): Promise<void> {
  try {
    await recorder(event);
  } catch {
    // OAuth must remain available when telemetry storage is temporarily unavailable.
  }
}
