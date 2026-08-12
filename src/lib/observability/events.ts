import { createHmac } from "node:crypto";
import { neon } from "@neondatabase/serverless";

export type AppEventName =
  | "install_completed"
  | "install_failed"
  | "scan_started"
  | "scan_completed"
  | "scan_failed"
  | "export_completed"
  | "token_refreshed"
  | "uninstalled";

export type AppEvent = {
  installationId: string;
  name: AppEventName;
  result: "success" | "failure";
  durationMs?: number;
  errorCode?: string;
};

export type StoredAppEvent = Omit<AppEvent, "installationId"> & {
  installationHash: string;
  occurredAt: string;
};

export interface AppEventStore {
  write(event: StoredAppEvent): Promise<void>;
}

type RecordDependencies = {
  store?: AppEventStore;
  hashingSecret?: string;
  now?: () => Date;
};

export async function recordAppEvent(event: AppEvent, deps: RecordDependencies = {}): Promise<void> {
  const hashingSecret = deps.hashingSecret ?? process.env.INSTALLATION_SECRET;
  if (!hashingSecret || hashingSecret.length < 24) {
    throw new Error("INSTALLATION_SECRET must be configured before recording app events.");
  }

  const store = deps.store ?? eventStoreFromEnvironment();
  await store.write({
    installationHash: createHmac("sha256", hashingSecret).update(event.installationId).digest("hex"),
    name: event.name,
    result: event.result,
    durationMs: event.durationMs,
    errorCode: event.errorCode,
    occurredAt: (deps.now ?? (() => new Date()))().toISOString()
  });
}

class NeonAppEventStore implements AppEventStore {
  private readonly sql: ReturnType<typeof neon>;
  private ready: Promise<unknown> | undefined;

  constructor(databaseUrl: string) {
    this.sql = neon(databaseUrl);
  }

  async write(event: StoredAppEvent): Promise<void> {
    await this.ensureTable();
    await this.sql`
      insert into paymatch_app_events (
        installation_hash, event_name, result, duration_ms, error_code, occurred_at
      ) values (
        ${event.installationHash}, ${event.name}, ${event.result}, ${event.durationMs ?? null},
        ${event.errorCode ?? null}, ${event.occurredAt}
      )
    `;
  }

  private ensureTable(): Promise<unknown> {
    this.ready ??= this.sql`
      create table if not exists paymatch_app_events (
        id bigserial primary key,
        installation_hash text not null,
        event_name text not null,
        result text not null,
        duration_ms integer,
        error_code text,
        occurred_at timestamptz not null
      )
    `;
    return this.ready;
  }
}

function eventStoreFromEnvironment(): AppEventStore {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be configured before recording app events.");
  }
  return new NeonAppEventStore(databaseUrl);
}
