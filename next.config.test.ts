import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

describe("Next.js response headers", () => {
  it("prevents encrypted installation sessions from leaking through referrers", async () => {
    const configuredHeaders = await nextConfig.headers?.();
    const headers = configuredHeaders?.flatMap((entry) => entry.headers) ?? [];

    expect(headers).toContainEqual({ key: "Referrer-Policy", value: "no-referrer" });
  });
});
