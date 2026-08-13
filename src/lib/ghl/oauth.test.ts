import { describe, expect, it } from "vitest";
import {
  DEFAULT_SAFE_SCOPES,
  assertReadonlyScopes,
  buildLocationTokenRequest,
  buildRefreshTokenRequest,
  buildTokenExchangeRequest
} from "./oauth";

describe("HighLevel OAuth helpers", () => {
  it("ships readonly data scopes plus the location-token control permission", () => {
    expect(DEFAULT_SAFE_SCOPES).toEqual([
      "invoices.readonly",
      "payments/transactions.readonly",
      "payments/subscriptions.readonly",
      "payments/orders.readonly",
      "contacts.readonly",
      "products.readonly",
      "products/prices.readonly",
      "oauth.readonly",
      "oauth.write"
    ]);
    expect(() => assertReadonlyScopes(DEFAULT_SAFE_SCOPES)).not.toThrow();
    expect(() => assertReadonlyScopes([...DEFAULT_SAFE_SCOPES, "contacts.write"])).toThrow(/write/i);
  });

  it("builds a v3 location-token request for an approved sub-account", () => {
    const request = buildLocationTokenRequest({
      agencyAccessToken: "agency_token",
      companyId: "company_123",
      locationId: "location_123"
    });

    expect(request.url).toBe("https://services.leadconnectorhq.com/oauth/location-token");
    expect(request.init).toMatchObject({
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: "Bearer agency_token",
        "Content-Type": "application/x-www-form-urlencoded",
        Version: "v3"
      }
    });
    expect(Object.fromEntries(new URLSearchParams(String(request.init.body)))).toEqual({
      companyId: "company_123",
      locationId: "location_123"
    });
  });

  it("builds an authorization-code exchange request matching HighLevel token docs", () => {
    const request = buildTokenExchangeRequest({
      clientId: "client_123",
      clientSecret: "secret_123",
      code: "code_123",
      redirectUri: "https://paymatch.example/api/ghl/callback",
      userType: "Location"
    });

    expect(request.url).toBe("https://services.leadconnectorhq.com/oauth/token");
    expect(request.init.method).toBe("POST");
    expect(request.init.headers).toMatchObject({
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded"
    });
    expect(Object.fromEntries(new URLSearchParams(String(request.init.body)))).toMatchObject({
      client_id: "client_123",
      client_secret: "secret_123",
      grant_type: "authorization_code",
      code: "code_123",
      redirect_uri: "https://paymatch.example/api/ghl/callback",
      user_type: "Location"
    });
  });

  it("builds a refresh request and rotates refresh tokens through the same endpoint", () => {
    const request = buildRefreshTokenRequest({
      clientId: "client_123",
      clientSecret: "secret_123",
      refreshToken: "refresh_123",
      redirectUri: "https://paymatch.example/api/ghl/callback",
      userType: "Location"
    });

    expect(request.url).toBe("https://services.leadconnectorhq.com/oauth/token");
    expect(Object.fromEntries(new URLSearchParams(String(request.init.body)))).toMatchObject({
      grant_type: "refresh_token",
      refresh_token: "refresh_123",
      user_type: "Location"
    });
  });
});
