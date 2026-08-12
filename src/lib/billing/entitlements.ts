import { neon } from "@neondatabase/serverless";

export type PayMatchPlan = "free" | "starter" | "pro";
export type PaymentStatus = "COMPLETE" | "FAILED" | "PENDING";

export type PayMatchEntitlement = {
  plan: PayMatchPlan;
  locationLimit: number;
  scansRemaining: number | null;
};

export type ScanReservation = {
  allowed: boolean;
  consumedFreeScan: boolean;
};

export type BillingState = {
  installationId: string;
  planId?: string;
  paymentStatus: PaymentStatus;
  trialEndsAt?: string;
  scansUsed: number;
  updatedAt: string;
};

export type MarketplaceBillingEvent = {
  type?: string;
  appId?: string;
  companyId?: string;
  locationId?: string;
  planId?: string;
  currentPlanId?: string;
  newPlanId?: string;
  previousStatus?: PaymentStatus;
  newStatus?: PaymentStatus;
  trial?: {
    onTrial?: boolean;
    trialDuration?: number;
    trialStartDate?: string;
  };
};

export interface EntitlementStore {
  get(installationId: string): Promise<BillingState | undefined>;
  upsertPlan(input: {
    installationId: string;
    planId?: string;
    paymentStatus?: PaymentStatus;
    trialEndsAt?: string | null;
  }): Promise<void>;
  setPaymentStatus(installationId: string, status: PaymentStatus): Promise<void>;
  reserveFreeScan(installationId: string): Promise<boolean>;
  releaseFreeScan(installationId: string): Promise<void>;
  delete(installationId: string): Promise<void>;
}

type PlanIds = {
  starter?: string;
  pro?: string;
};

type EntitlementDependencies = {
  store?: EntitlementStore;
  planIds?: PlanIds;
  now?: Date;
};

type StoreOptions = {
  databaseUrl?: string;
  environment?: string;
};

const FREE_SCAN_LIMIT = 1;
const DEFAULT_PRO_LOCATION_LIMIT = 10;
const memoryStates = new Map<string, BillingState>();
let cachedStore: EntitlementStore | undefined;

export function getEntitlementStore(options: StoreOptions = {}): EntitlementStore {
  const explicit = Object.keys(options).length > 0;
  const databaseUrl = options.databaseUrl ?? process.env.DATABASE_URL;
  const environment = options.environment ?? process.env.NODE_ENV;

  if (!databaseUrl && environment === "production") {
    throw new Error("DATABASE_URL must be configured in production; in-memory entitlement storage is not allowed.");
  }

  if (explicit) {
    return databaseUrl ? new NeonEntitlementStore(databaseUrl) : new MemoryEntitlementStore();
  }

  cachedStore ??= databaseUrl ? new NeonEntitlementStore(databaseUrl) : new MemoryEntitlementStore();
  return cachedStore;
}

export async function getPayMatchEntitlement(
  installationId: string,
  deps: EntitlementDependencies = {}
): Promise<PayMatchEntitlement> {
  const state = await (deps.store ?? getEntitlementStore()).get(installationId);
  const plan = resolvePlan(state, deps.planIds ?? planIdsFromEnvironment(), deps.now ?? new Date());

  if (plan === "starter") {
    return { plan, locationLimit: 1, scansRemaining: null };
  }
  if (plan === "pro") {
    return { plan, locationLimit: proLocationLimit(), scansRemaining: null };
  }

  return {
    plan: "free",
    locationLimit: 1,
    scansRemaining: Math.max(0, FREE_SCAN_LIMIT - (state?.scansUsed ?? 0))
  };
}

export async function reservePayMatchScan(
  installationId: string,
  deps: EntitlementDependencies = {}
): Promise<ScanReservation> {
  const store = deps.store ?? getEntitlementStore();
  const entitlement = await getPayMatchEntitlement(installationId, { ...deps, store });
  if (entitlement.plan !== "free") {
    return { allowed: true, consumedFreeScan: false };
  }
  const allowed = await store.reserveFreeScan(installationId);
  return { allowed, consumedFreeScan: allowed };
}

export async function releasePayMatchScan(
  installationId: string,
  deps: Pick<EntitlementDependencies, "store"> = {}
): Promise<void> {
  await (deps.store ?? getEntitlementStore()).releaseFreeScan(installationId);
}

export async function applyMarketplaceBillingEvent(
  event: MarketplaceBillingEvent,
  deps: { store?: EntitlementStore; expectedAppId?: string } = {}
): Promise<void> {
  const expectedAppId = deps.expectedAppId ?? process.env.GHL_APP_ID;
  if (!expectedAppId) {
    throw new Error("Webhook app identity is not configured.");
  }
  if (event.appId !== expectedAppId) {
    throw new Error("Webhook does not match this app.");
  }

  const installationId = event.locationId ?? event.companyId;
  if (!installationId) {
    throw new Error("Webhook is missing an installation id.");
  }

  const store = deps.store ?? getEntitlementStore();
  switch (event.type) {
    case "INSTALL":
      await store.upsertPlan({
        installationId,
        planId: event.planId,
        paymentStatus: event.trial?.onTrial ? "PENDING" : "COMPLETE",
        trialEndsAt: trialEnd(event.trial)
      });
      return;
    case "UPDATE":
      await store.upsertPlan({
        installationId,
        planId: event.planId,
        trialEndsAt: trialEnd(event.trial)
      });
      return;
    case "PLAN_CHANGE":
      if (!event.newPlanId) {
        throw new Error("Plan change webhook is missing the new plan id.");
      }
      await store.upsertPlan({
        installationId,
        planId: event.newPlanId,
        paymentStatus: "COMPLETE",
        trialEndsAt: null
      });
      return;
    case "APP_PAYMENT_STATUS":
      if (!event.newStatus || !isPaymentStatus(event.newStatus)) {
        throw new Error("Payment webhook has an invalid status.");
      }
      await store.setPaymentStatus(installationId, event.newStatus);
      return;
    case "UNINSTALL":
      await store.delete(installationId);
      return;
    default:
      throw new Error("Unsupported marketplace webhook event.");
  }
}

function resolvePlan(state: BillingState | undefined, planIds: PlanIds, now: Date): PayMatchPlan {
  if (!state?.planId) {
    return "free";
  }

  const mappedPlan = state.planId === planIds.starter ? "starter" : state.planId === planIds.pro ? "pro" : "free";
  if (mappedPlan === "free") {
    return "free";
  }

  const activeTrial = state.trialEndsAt ? new Date(state.trialEndsAt).getTime() > now.getTime() : false;
  return state.paymentStatus === "COMPLETE" || activeTrial ? mappedPlan : "free";
}

function trialEnd(trial: MarketplaceBillingEvent["trial"]): string | null | undefined {
  if (trial === undefined) {
    return undefined;
  }
  if (!trial.onTrial) {
    return null;
  }
  if (!trial.trialStartDate || !Number.isFinite(trial.trialDuration)) {
    return null;
  }

  const start = new Date(trial.trialStartDate);
  if (Number.isNaN(start.getTime())) {
    return null;
  }
  return new Date(start.getTime() + Number(trial.trialDuration) * 86_400_000).toISOString();
}

function planIdsFromEnvironment(): PlanIds {
  return {
    starter: process.env.GHL_PAYMATCH_STARTER_PLAN_ID,
    pro: process.env.GHL_PAYMATCH_PRO_PLAN_ID
  };
}

function proLocationLimit(): number {
  const configured = Number(process.env.GHL_PAYMATCH_PRO_LOCATION_LIMIT ?? DEFAULT_PRO_LOCATION_LIMIT);
  return Number.isInteger(configured) && configured > 1 ? configured : DEFAULT_PRO_LOCATION_LIMIT;
}

function isPaymentStatus(value: string): value is PaymentStatus {
  return value === "COMPLETE" || value === "FAILED" || value === "PENDING";
}

class MemoryEntitlementStore implements EntitlementStore {
  async get(installationId: string): Promise<BillingState | undefined> {
    return memoryStates.get(installationId);
  }

  async upsertPlan(input: {
    installationId: string;
    planId?: string;
    paymentStatus?: PaymentStatus;
    trialEndsAt?: string | null;
  }): Promise<void> {
    const current = memoryStates.get(input.installationId);
    memoryStates.set(input.installationId, {
      installationId: input.installationId,
      planId: input.planId ?? current?.planId,
      paymentStatus: input.paymentStatus ?? current?.paymentStatus ?? "PENDING",
      trialEndsAt: input.trialEndsAt === null ? undefined : input.trialEndsAt ?? current?.trialEndsAt,
      scansUsed: current?.scansUsed ?? 0,
      updatedAt: new Date().toISOString()
    });
  }

  async setPaymentStatus(installationId: string, status: PaymentStatus): Promise<void> {
    const current = memoryStates.get(installationId);
    memoryStates.set(installationId, {
      installationId,
      planId: current?.planId,
      paymentStatus: status,
      trialEndsAt: current?.trialEndsAt,
      scansUsed: current?.scansUsed ?? 0,
      updatedAt: new Date().toISOString()
    });
  }

  async reserveFreeScan(installationId: string): Promise<boolean> {
    const current = memoryStates.get(installationId);
    if ((current?.scansUsed ?? 0) >= FREE_SCAN_LIMIT) {
      return false;
    }
    memoryStates.set(installationId, {
      installationId,
      planId: current?.planId,
      paymentStatus: current?.paymentStatus ?? "PENDING",
      trialEndsAt: current?.trialEndsAt,
      scansUsed: (current?.scansUsed ?? 0) + 1,
      updatedAt: new Date().toISOString()
    });
    return true;
  }

  async releaseFreeScan(installationId: string): Promise<void> {
    const current = memoryStates.get(installationId);
    if (current) {
      memoryStates.set(installationId, {
        ...current,
        scansUsed: Math.max(0, current.scansUsed - 1),
        updatedAt: new Date().toISOString()
      });
    }
  }

  async delete(installationId: string): Promise<void> {
    memoryStates.delete(installationId);
  }
}

class NeonEntitlementStore implements EntitlementStore {
  private readonly sql: ReturnType<typeof neon>;
  private ready: Promise<unknown> | undefined;

  constructor(databaseUrl: string) {
    this.sql = neon(databaseUrl);
  }

  async get(installationId: string): Promise<BillingState | undefined> {
    await this.ensureTable();
    const rows = (await this.sql`
      select installation_id, plan_id, payment_status, trial_ends_at, scans_used, updated_at
      from paymatch_entitlements
      where installation_id = ${installationId}
      limit 1
    `) as Record<string, unknown>[];
    const row = rows[0];
    if (!row) {
      return undefined;
    }
    return {
      installationId: String(row.installation_id),
      planId: optionalString(row.plan_id),
      paymentStatus: isPaymentStatus(String(row.payment_status)) ? String(row.payment_status) as PaymentStatus : "PENDING",
      trialEndsAt: optionalString(row.trial_ends_at),
      scansUsed: Number(row.scans_used ?? 0),
      updatedAt: String(row.updated_at)
    };
  }

  async upsertPlan(input: {
    installationId: string;
    planId?: string;
    paymentStatus?: PaymentStatus;
    trialEndsAt?: string | null;
  }): Promise<void> {
    await this.ensureTable();
    await this.sql`
      insert into paymatch_entitlements (installation_id, plan_id, payment_status, trial_ends_at, scans_used, updated_at)
      values (
        ${input.installationId},
        ${input.planId ?? null},
        ${input.paymentStatus ?? "PENDING"},
        ${input.trialEndsAt ?? null},
        0,
        now()
      )
      on conflict (installation_id) do update set
        plan_id = coalesce(excluded.plan_id, paymatch_entitlements.plan_id),
        payment_status = coalesce(${input.paymentStatus ?? null}, paymatch_entitlements.payment_status),
        trial_ends_at = case
          when ${input.trialEndsAt !== undefined} then ${input.trialEndsAt ?? null}
          else paymatch_entitlements.trial_ends_at
        end,
        updated_at = now()
    `;
  }

  async setPaymentStatus(installationId: string, status: PaymentStatus): Promise<void> {
    await this.ensureTable();
    await this.sql`
      insert into paymatch_entitlements (installation_id, payment_status, scans_used, updated_at)
      values (${installationId}, ${status}, 0, now())
      on conflict (installation_id) do update set payment_status = excluded.payment_status, updated_at = now()
    `;
  }

  async reserveFreeScan(installationId: string): Promise<boolean> {
    await this.ensureTable();
    const rows = (await this.sql`
      insert into paymatch_entitlements (installation_id, payment_status, scans_used, updated_at)
      values (${installationId}, 'PENDING', 1, now())
      on conflict (installation_id) do update set
        scans_used = paymatch_entitlements.scans_used + 1,
        updated_at = now()
      where paymatch_entitlements.scans_used < ${FREE_SCAN_LIMIT}
      returning installation_id
    `) as Record<string, unknown>[];
    return rows.length > 0;
  }

  async releaseFreeScan(installationId: string): Promise<void> {
    await this.ensureTable();
    await this.sql`
      update paymatch_entitlements
      set scans_used = greatest(0, scans_used - 1), updated_at = now()
      where installation_id = ${installationId}
    `;
  }

  async delete(installationId: string): Promise<void> {
    await this.ensureTable();
    await this.sql`delete from paymatch_entitlements where installation_id = ${installationId}`;
  }

  private ensureTable(): Promise<unknown> {
    this.ready ??= this.sql`
      create table if not exists paymatch_entitlements (
        installation_id text primary key,
        plan_id text,
        payment_status text not null default 'PENDING',
        trial_ends_at timestamptz,
        scans_used integer not null default 0 check (scans_used >= 0),
        updated_at timestamptz not null default now()
      )
    `;
    return this.ready;
  }
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
