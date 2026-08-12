import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import type { HighLevelTokenResponse, HighLevelUserType } from "@/lib/ghl/oauth";

export type PayMatchInstallation = {
  id: string;
  locationId?: string;
  companyId?: string;
  userId?: string;
  userType: HighLevelUserType;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  scopes: string[];
  createdAt: string;
  updatedAt: string;
};

export interface InstallationStore {
  get(id: string): Promise<PayMatchInstallation | undefined>;
  save(installation: PayMatchInstallation): Promise<void>;
  delete(id: string): Promise<void>;
}

type InstallationStoreOptions = {
  databaseUrl?: string;
  environment?: string;
};

const memoryInstallations = new Map<string, PayMatchInstallation>();
let cachedStore: InstallationStore | undefined;

export function getInstallationStore(options: InstallationStoreOptions = {}): InstallationStore {
  const hasExplicitOptions = Object.keys(options).length > 0;
  const databaseUrl = options.databaseUrl ?? process.env.DATABASE_URL;
  const environment = options.environment ?? process.env.NODE_ENV;

  if (!databaseUrl && environment === "production") {
    throw new Error("DATABASE_URL must be configured in production; in-memory OAuth storage is not allowed.");
  }

  if (hasExplicitOptions) {
    return databaseUrl ? new NeonInstallationStore(databaseUrl) : new MemoryInstallationStore();
  }

  if (cachedStore) {
    return cachedStore;
  }

  cachedStore = databaseUrl ? new NeonInstallationStore(databaseUrl) : new MemoryInstallationStore();
  return cachedStore;
}

export function installationFromTokenResponse(token: HighLevelTokenResponse): PayMatchInstallation {
  const now = new Date();
  const id = token.locationId ?? token.companyId ?? token.userId;

  if (!id) {
    throw new Error("HighLevel token response did not include a locationId, companyId, or userId.");
  }

  return {
    id,
    locationId: token.locationId,
    companyId: token.companyId,
    userId: token.userId,
    userType: token.userType ?? "Location",
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: new Date(now.getTime() + token.expires_in * 1000).toISOString(),
    scopes: token.scope?.split(/\s+/).filter(Boolean) ?? [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };
}

class MemoryInstallationStore implements InstallationStore {
  async get(id: string): Promise<PayMatchInstallation | undefined> {
    return memoryInstallations.get(id);
  }

  async save(installation: PayMatchInstallation): Promise<void> {
    memoryInstallations.set(installation.id, installation);
  }

  async delete(id: string): Promise<void> {
    memoryInstallations.delete(id);
  }
}

class NeonInstallationStore implements InstallationStore {
  private readonly sql: ReturnType<typeof neon>;
  private ready: Promise<unknown> | undefined;

  constructor(databaseUrl: string) {
    this.sql = neon(databaseUrl);
  }

  async get(id: string): Promise<PayMatchInstallation | undefined> {
    await this.ensureTable();
    const rows = (await this.sql`
      select id, location_id, company_id, user_id, user_type, access_token, refresh_token, expires_at, scopes, created_at, updated_at
      from paymatch_installations
      where id = ${id}
      limit 1
    `) as Record<string, unknown>[];
    const row = rows[0];

    if (!row) {
      return undefined;
    }

    return {
      id: String(row.id),
      locationId: optionalString(row.location_id),
      companyId: optionalString(row.company_id),
      userId: optionalString(row.user_id),
      userType: (optionalString(row.user_type) as HighLevelUserType | undefined) ?? "Location",
      accessToken: openToken(String(row.access_token)),
      refreshToken: openToken(String(row.refresh_token)),
      expiresAt: String(row.expires_at),
      scopes: parseScopes(row.scopes),
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at)
    };
  }

  async save(installation: PayMatchInstallation): Promise<void> {
    await this.ensureTable();
    await this.sql`
      insert into paymatch_installations (
        id, location_id, company_id, user_id, user_type, access_token, refresh_token, expires_at, scopes, created_at, updated_at
      ) values (
        ${installation.id},
        ${installation.locationId ?? null},
        ${installation.companyId ?? null},
        ${installation.userId ?? null},
        ${installation.userType},
        ${sealToken(installation.accessToken)},
        ${sealToken(installation.refreshToken)},
        ${installation.expiresAt},
        ${JSON.stringify(installation.scopes)},
        ${installation.createdAt},
        ${installation.updatedAt}
      )
      on conflict (id) do update set
        location_id = excluded.location_id,
        company_id = excluded.company_id,
        user_id = excluded.user_id,
        user_type = excluded.user_type,
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        expires_at = excluded.expires_at,
        scopes = excluded.scopes,
        updated_at = excluded.updated_at
    `;
  }

  async delete(id: string): Promise<void> {
    await this.ensureTable();
    await this.sql`delete from paymatch_installations where id = ${id}`;
  }

  private ensureTable(): Promise<unknown> {
    this.ready ??= this.sql`
      create table if not exists paymatch_installations (
        id text primary key,
        location_id text,
        company_id text,
        user_id text,
        user_type text not null,
        access_token text not null,
        refresh_token text not null,
        expires_at timestamptz not null,
        scopes jsonb not null default '[]'::jsonb,
        created_at timestamptz not null,
        updated_at timestamptz not null
      )
    `;
    return this.ready;
  }
}

function sealToken(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

function openToken(value: string): string {
  const [version, iv, tag, encrypted] = value.split(":");
  if (version !== "v1" || !iv || !tag || !encrypted) {
    throw new Error("Stored token is not in a supported encrypted format.");
  }

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64")), decipher.final()]).toString("utf8");
}

function encryptionKey(): Buffer {
  const secret = process.env.INSTALLATION_SECRET;
  if (!secret || secret.length < 24) {
    throw new Error("INSTALLATION_SECRET must be set to at least 24 characters before storing HighLevel tokens.");
  }

  return createHash("sha256").update(secret).digest();
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function parseScopes(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(String);
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  return [];
}
