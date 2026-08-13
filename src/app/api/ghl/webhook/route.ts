import { NextResponse } from "next/server";
import { applyMarketplaceBillingEvent, type MarketplaceBillingEvent } from "@/lib/billing/entitlements";
import { verifyGhlWebhookSignature } from "@/lib/ghl/webhook";
import { provisionLocationInstallation } from "@/lib/ghl/provision-location";
import { getInstallationStore, type InstallationStore } from "@/lib/store/installations";

type WebhookDependencies = {
  verifySignature?: (body: string, signature: string | null) => boolean;
  applyEvent?: (event: MarketplaceBillingEvent) => Promise<void>;
  installationStore?: InstallationStore;
  provisionLocation?: (input: { companyId: string; locationId: string }) => Promise<unknown>;
};

export async function POST(request: Request) {
  return handleMarketplaceWebhook(request);
}

export async function handleMarketplaceWebhook(request: Request, deps: WebhookDependencies = {}) {
  const body = await request.text();
  const signature = request.headers.get("X-GHL-Signature");
  if (!(deps.verifySignature ?? verifyGhlWebhookSignature)(body, signature)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let event: MarketplaceBillingEvent;
  try {
    event = JSON.parse(body) as MarketplaceBillingEvent;
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  try {
    await (deps.applyEvent ?? applyMarketplaceBillingEvent)(event);
    if (event.type === "INSTALL" && event.companyId && event.locationId) {
      await (deps.provisionLocation ?? provisionLocationInstallation)({
        companyId: event.companyId,
        locationId: event.locationId
      });
    }
    if (event.type === "UNINSTALL") {
      const installationId = event.locationId ?? event.companyId;
      if (installationId) {
        await (deps.installationStore ?? getInstallationStore()).delete(installationId);
      }
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Marketplace webhook failed.";
    const clientError =
      message === "Unsupported marketplace webhook event." ||
      message === "Webhook does not match this app." ||
      message === "Webhook is missing an installation id." ||
      message === "Plan change webhook is missing the new plan id." ||
      message === "Payment webhook has an invalid status.";
    return NextResponse.json({ error: message }, { status: clientError ? 400 : 500 });
  }
}
