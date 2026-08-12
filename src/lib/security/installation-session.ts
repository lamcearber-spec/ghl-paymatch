import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

type SessionOptions = {
  secret?: string;
  now?: Date;
  lifetimeMs?: number;
};

const DEFAULT_SESSION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

export function createInstallationSession(installationId: string, options: SessionOptions = {}): string {
  const now = options.now ?? new Date();
  const payload = JSON.stringify({
    installationId,
    expiresAt: now.getTime() + (options.lifetimeMs ?? DEFAULT_SESSION_LIFETIME_MS)
  });
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", sessionKey(options.secret), iv);
  const encrypted = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv, tag, encrypted].map((part) => typeof part === "string" ? part : part.toString("base64url")).join(".");
}

export function readInstallationSession(session: string, options: SessionOptions = {}): string {
  try {
    const [version, iv, tag, encrypted] = session.split(".");
    if (version !== "v1" || !iv || !tag || !encrypted) {
      throw new Error("invalid");
    }
    const decipher = createDecipheriv("aes-256-gcm", sessionKey(options.secret), Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    const payload = JSON.parse(
      Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8")
    ) as { installationId?: unknown; expiresAt?: unknown };

    if (typeof payload.installationId !== "string" || typeof payload.expiresAt !== "number") {
      throw new Error("invalid");
    }
    if (payload.expiresAt <= (options.now ?? new Date()).getTime()) {
      throw new InstallationSessionExpiredError();
    }
    return payload.installationId;
  } catch (error) {
    if (error instanceof InstallationSessionExpiredError) {
      throw error;
    }
    throw new Error("Installation session is invalid.");
  }
}

class InstallationSessionExpiredError extends Error {
  constructor() {
    super("Installation session has expired.");
  }
}

function sessionKey(explicitSecret?: string): Buffer {
  const secret = explicitSecret ?? process.env.INSTALLATION_SECRET;
  if (!secret || secret.length < 24) {
    throw new Error("INSTALLATION_SECRET must be set to at least 24 characters before creating an installation session.");
  }
  return createHash("sha256").update(secret).digest();
}
