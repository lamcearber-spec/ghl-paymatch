import { NextResponse } from "next/server";
import { getPayMatchEntitlement, type PayMatchEntitlement } from "@/lib/billing/entitlements";
import { readInstallationSession } from "@/lib/security/installation-session";

type BillingStatusDependencies = {
  getEntitlement?: (installationId: string) => Promise<PayMatchEntitlement>;
};

export async function GET(request: Request) {
  return handleBillingStatus(request);
}

export async function handleBillingStatus(request: Request, deps: BillingStatusDependencies = {}) {
  const session = new URL(request.url).searchParams.get("session")?.trim();
  if (!session) {
    return NextResponse.json({ error: "session is required." }, { status: 400 });
  }

  let installationId: string;
  try {
    installationId = readInstallationSession(session);
  } catch {
    return NextResponse.json({ error: "invalid_session" }, { status: 401 });
  }

  const entitlement = await (deps.getEntitlement ?? getPayMatchEntitlement)(installationId);
  return NextResponse.json(entitlement);
}
