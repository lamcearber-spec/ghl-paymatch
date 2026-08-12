import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/oauth/callback", () => {
  it("uses the shared OAuth callback handler", async () => {
    const response = await GET(new Request("https://paymatch.test/api/oauth/callback"));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Missing authorization code." });
  });
});
