import { neon } from "@neondatabase/serverless";
import type { AffiliateDestination, AffiliateSubId } from "@/lib/affiliate/links";

export type AffiliateClick = {
  destination: AffiliateDestination;
  subId: AffiliateSubId;
};

export type StoredAffiliateClick = AffiliateClick & {
  occurredAt: string;
};

export interface AffiliateClickStore {
  write(click: StoredAffiliateClick): Promise<void>;
}

type RecordAffiliateClickDependencies = {
  store?: AffiliateClickStore;
  now?: () => Date;
};

export async function recordAffiliateClick(
  click: AffiliateClick,
  dependencies: RecordAffiliateClickDependencies = {}
): Promise<void> {
  const store = dependencies.store ?? clickStoreFromEnvironment();
  await store.write({
    ...click,
    occurredAt: (dependencies.now ?? (() => new Date()))().toISOString()
  });
}

class NeonAffiliateClickStore implements AffiliateClickStore {
  private readonly sql: ReturnType<typeof neon>;
  private ready: Promise<unknown> | undefined;

  constructor(databaseUrl: string) {
    this.sql = neon(databaseUrl);
  }

  async write(click: StoredAffiliateClick): Promise<void> {
    await this.ensureTable();
    await this.sql`
      insert into paymatch_affiliate_clicks (destination, sub_id, occurred_at)
      values (${click.destination}, ${click.subId}, ${click.occurredAt})
    `;
  }

  private ensureTable(): Promise<unknown> {
    this.ready ??= this.sql`
      create table if not exists paymatch_affiliate_clicks (
        id bigserial primary key,
        destination text not null,
        sub_id text not null,
        occurred_at timestamptz not null
      )
    `;
    return this.ready;
  }
}

function clickStoreFromEnvironment(): AffiliateClickStore {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL must be configured before recording affiliate clicks.");
  }
  return new NeonAffiliateClickStore(databaseUrl);
}
