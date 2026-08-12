import { NextResponse } from "next/server";
import { scanPayMatch } from "@/lib/paymatch/scan";
import type { PayMatchScan, PayMatchScanParams } from "@/lib/paymatch/scan";
import { InstallationNotFoundError, TokenRefreshError } from "@/lib/ghl/session";

type ReconcileDependencies = {
  scanner?: (params: PayMatchScanParams) => Promise<PayMatchScan>;
};

export async function GET(request: Request) {
  return handleReconcile(request);
}

export async function handleReconcile(request: Request, deps: ReconcileDependencies = {}) {
  const url = new URL(request.url);
  try {
    const scan = await (deps.scanner ?? scanPayMatch)({
      installationId: url.searchParams.get("installationId") ?? undefined,
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
    return NextResponse.json(
      { error: "scan_failed", message: "PayMatch could not complete this scan. Try again shortly." },
      { status: 502 }
    );
  }
}
