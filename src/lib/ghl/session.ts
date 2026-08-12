import { buildRefreshTokenRequest, type HighLevelTokenResponse } from "./oauth";
import {
  getInstallationStore,
  type InstallationStore,
  type PayMatchInstallation
} from "@/lib/store/installations";
import { recordAppEvent, type AppEvent } from "@/lib/observability/events";

type OAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

type SessionDependencies = {
  store?: InstallationStore;
  fetcher?: typeof fetch;
  now?: () => Date;
  oauthConfig?: OAuthConfig;
  recordEvent?: (event: AppEvent) => Promise<void>;
};

const EXPIRY_SAFETY_WINDOW_MS = 60_000;

export class InstallationNotFoundError extends Error {
  constructor() {
    super("HighLevel installation was not found.");
    this.name = "InstallationNotFoundError";
  }
}

export class TokenRefreshError extends Error {
  constructor(public readonly status: number) {
    super(`HighLevel token refresh failed: ${status}`);
    this.name = "TokenRefreshError";
  }
}

export async function getValidInstallation(
  id: string,
  deps: SessionDependencies = {}
): Promise<PayMatchInstallation> {
  const store = deps.store ?? getInstallationStore();
  const installation = await store.get(id);

  if (!installation) {
    throw new InstallationNotFoundError();
  }

  const now = (deps.now ?? (() => new Date()))();
  if (new Date(installation.expiresAt).getTime() > now.getTime() + EXPIRY_SAFETY_WINDOW_MS) {
    return installation;
  }

  const config = deps.oauthConfig ?? oauthConfigFromEnvironment();
  const tokenRequest = buildRefreshTokenRequest({
    ...config,
    refreshToken: installation.refreshToken,
    userType: installation.userType
  });
  const response = await (deps.fetcher ?? fetch)(tokenRequest.url, tokenRequest.init);

  if (!response.ok) {
    throw new TokenRefreshError(response.status);
  }

  const token = (await response.json()) as HighLevelTokenResponse;
  const updated: PayMatchInstallation = {
    ...installation,
    accessToken: token.access_token,
    refreshToken: token.refresh_token || installation.refreshToken,
    expiresAt: new Date(now.getTime() + token.expires_in * 1000).toISOString(),
    scopes: token.scope?.split(/\s+/).filter(Boolean) ?? installation.scopes,
    updatedAt: now.toISOString()
  };
  await store.save(updated);
  await safeRecordEvent(deps.recordEvent ?? recordAppEvent, {
    installationId: installation.id,
    name: "token_refreshed",
    result: "success"
  });
  return updated;
}

async function safeRecordEvent(recorder: (event: AppEvent) => Promise<void>, event: AppEvent): Promise<void> {
  try {
    await recorder(event);
  } catch {
    // Telemetry must never invalidate a successfully refreshed OAuth session.
  }
}

function oauthConfigFromEnvironment(): OAuthConfig {
  const clientId = process.env.GHL_CLIENT_ID;
  const clientSecret = process.env.GHL_CLIENT_SECRET;
  const redirectUri = process.env.GHL_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("OAuth environment variables are not configured.");
  }

  return { clientId, clientSecret, redirectUri };
}
