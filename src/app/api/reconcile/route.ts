import { NextResponse } from "next/server";
import { ScanLimitExceededError, scanPayMatch } from "@/lib/paymatch/scan";
import type { PayMatchScan, PayMatchScanParams } from "@/lib/paymatch/scan";
import { InstallationNotFoundError, TokenRefreshError } from "@/lib/ghl/session";
import { readInstallationSession } from "@/lib/security/installation-session";

type ReconcileDependencies = {
  scanner?: (params: PayMatchScanParams) => Promise<PayMatchScan>;
};

export async function GET(request: Request) {
  return handleReconcile(request);
}

export async function handleReconcile(request: Request, deps: ReconcileDependencies = {}) {
  const url = new URL(request.url);
  const session = url.searchParams.get("session");
  let installationId: string | undefined;
  if (session) {
    try {
      installationId = readInstallationSession(session);
    } catch {
      return NextResponse.json(
        { error: "invalid_session", message: "Reconnect PayMatch to continue." },
        { status: 401 }
      );
    }
  }
  try {
    const scan = await (deps.scanner ?? scanPayMatch)({
      installationId,
      locationId: url.searchParams.get("locationId") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined
    });

    return NextResponse.json(scan);
  } catch (error) {
    if (error instanceof InstallationNotFoundError) {
      return NextResponse.json(
        { error: "installation_not_found", message: "Reconnect PayMatch to continue." },
        { status: 404 }
      );
    }
    if (error instanceof TokenRefreshError) {
      return NextResponse.json(
        { error: "oauth_refresh_failed", message: "Reconnect PayMatch to continue." },
        { status: 502 }
      );
    }
    if (error instanceof ScanLimitExceededError) {
      return NextResponse.json(
        {
          error: "scan_limit_exceeded",
          message: "Your free live scan has been used. Upgrade PayMatch in HighLevel Marketplace to scan again."
        },
        { status: 402 }
      );
    }
    return NextResponse.json(
      { error: "scan_failed", message: "PayMatch could not complete this scan. Try again shortly." },
      { status: 502 }
    );
  }
}
