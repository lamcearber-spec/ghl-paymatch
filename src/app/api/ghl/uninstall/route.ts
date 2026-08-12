import { NextResponse } from "next/server";
import { verifyGhlWebhookSignature } from "@/lib/ghl/webhook";
import { recordAppEvent, type AppEvent } from "@/lib/observability/events";
import { getInstallationStore, type InstallationStore } from "@/lib/store/installations";
import { getEntitlementStore, type EntitlementStore } from "@/lib/billing/entitlements";

type UninstallPayload = {
  type?: string;
  appId?: string;
  companyId?: string;
  locationId?: string;
};

type UninstallDependencies = {
  store?: InstallationStore;
  entitlementStore?: EntitlementStore;
  verifySignature?: (body: string, signature: string | null) => boolean;
  recordEvent?: (event: AppEvent) => Promise<void>;
  expectedAppId?: string;
};

export async function POST(request: Request) {
  return handleUninstall(request);
}

export async function handleUninstall(request: Request, deps: UninstallDependencies = {}) {
  const body = await request.text();
  const signature = request.headers.get("X-GHL-Signature");
  if (!(deps.verifySignature ?? verifyGhlWebhookSignature)(body, signature)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let payload: UninstallPayload;
  try {
    payload = JSON.parse(body) as UninstallPayload;
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const expectedAppId = deps.expectedAppId ?? process.env.GHL_APP_ID;
  if (!expectedAppId) {
    return NextResponse.json({ error: "Webhook app identity is not configured." }, { status: 500 });
  }
  if (payload.type !== "UNINSTALL" || payload.appId !== expectedAppId) {
    return NextResponse.json({ error: "Webhook does not match this app." }, { status: 400 });
  }

  const installationId = payload.locationId ?? payload.companyId;
  if (!installationId) {
    return NextResponse.json({ error: "Webhook is missing an installation id." }, { status: 400 });
  }

  await (deps.store ?? getInstallationStore()).delete(installationId);
  await (deps.entitlementStore ?? getEntitlementStore()).delete(installationId);
  await safeRecordEvent(deps.recordEvent ?? recordAppEvent, {
    installationId,
    name: "uninstalled",
    result: "success"
  });
  return NextResponse.json({ success: true });
}

async function safeRecordEvent(recorder: (event: AppEvent) => Promise<void>, event: AppEvent): Promise<void> {
  try {
    await recorder(event);
  } catch {
    // HighLevel should not retry an already-applied uninstall due to telemetry failure.
  }
}
