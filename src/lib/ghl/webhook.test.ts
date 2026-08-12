import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyGhlWebhookSignature } from "./webhook";

describe("verifyGhlWebhookSignature", () => {
  it("accepts an Ed25519 signature for the exact request body", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const body = JSON.stringify({ type: "UNINSTALL", appId: "app_test", locationId: "loc_test" });
    const signature = sign(null, Buffer.from(body), privateKey).toString("base64");

    expect(verifyGhlWebhookSignature(body, signature, publicKey.export({ type: "spki", format: "pem" }).toString())).toBe(true);
  });

  it("rejects a signature when the payload changes", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const signature = sign(null, Buffer.from("original"), privateKey).toString("base64");

    expect(verifyGhlWebhookSignature("changed", signature, publicKey.export({ type: "spki", format: "pem" }).toString())).toBe(false);
  });
});
