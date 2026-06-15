export const HIGHLEVEL_TOKEN_URL = "https://services.leadconnectorhq.com/oauth/token";

export const DEFAULT_READONLY_SCOPES = [
  "invoices.readonly",
  "payments/transactions.readonly",
  "payments/subscriptions.readonly",
  "payments/orders.readonly",
  "contacts.readonly",
  "products.readonly",
  "products/prices.readonly"
] as const;

export type HighLevelUserType = "Location" | "Company";

type TokenRequestInput = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  userType: HighLevelUserType;
};

type CodeExchangeInput = TokenRequestInput & {
  code: string;
};

type RefreshInput = TokenRequestInput & {
  refreshToken: string;
};

export type HighLevelTokenResponse = {
  access_token: string;
  token_type: "Bearer" | string;
  expires_in: number;
  refresh_token: string;
  scope?: string;
  refreshTokenId?: string;
  userType?: HighLevelUserType;
  companyId?: string;
  locationId?: string;
  userId?: string;
};

export function assertReadonlyScopes(scopes: readonly string[]): void {
  const unsafeScope = scopes.find((scope) => !scope.endsWith(".readonly"));
  if (unsafeScope) {
    throw new Error(`PayMatch is read-only; unsafe scope rejected: ${unsafeScope}`);
  }
}

export function buildTokenExchangeRequest(input: CodeExchangeInput): { url: string; init: RequestInit } {
  return tokenRequest({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
    user_type: input.userType
  });
}

export function buildRefreshTokenRequest(input: RefreshInput): { url: string; init: RequestInit } {
  return tokenRequest({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    grant_type: "refresh_token",
    refresh_token: input.refreshToken,
    redirect_uri: input.redirectUri,
    user_type: input.userType
  });
}

function tokenRequest(body: Record<string, string>): { url: string; init: RequestInit } {
  const formBody = new URLSearchParams(body);

  return {
    url: HIGHLEVEL_TOKEN_URL,
    init: {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: formBody.toString()
    }
  };
}
