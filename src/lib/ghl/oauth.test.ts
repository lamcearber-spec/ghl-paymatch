import { describe, expect, it } from "vitest";
import {
  DEFAULT_READONLY_SCOPES,
  assertReadonlyScopes,
  buildRefreshTokenRequest,
  buildTokenExchangeRequest
} from "./oauth";

describe("HighLevel OAuth helpers", () => {
  it("ships only readonly scopes by default", () => {
    expect(DEFAULT_READONLY_SCOPES).toEqual([
      "invoices.readonly",
      "payments/transactions.readonly",
      "payments/subscriptions.readonly",
      "payments/orders.readonly",
      "contacts.readonly",
      "products.readonly",
      "products/prices.readonly"
    ]);
    expect(DEFAULT_READONLY_SCOPES.every((scope) => scope.endsWith(".readonly"))).toBe(true);
    expect(() => assertReadonlyScopes([...DEFAULT_READONLY_SCOPES, "contacts.write"])).toThrow(/write/i);
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
