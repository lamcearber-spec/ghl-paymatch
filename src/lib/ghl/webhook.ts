import { verify } from "node:crypto";

export const HIGHLEVEL_ED25519_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAi2HR1srL4o18O8BRa7gVJY7G7bupbN3H9AwJrHCDiOg=
-----END PUBLIC KEY-----`;

export function verifyGhlWebhookSignature(
  body: string,
  signature: string | null,
  publicKey = HIGHLEVEL_ED25519_PUBLIC_KEY
): boolean {
  if (!signature || signature === "N/A") {
    return false;
  }

  try {
    return verify(null, Buffer.from(body, "utf8"), publicKey, Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}
