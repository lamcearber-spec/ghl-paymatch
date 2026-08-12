import { PayMatchDashboard } from "@/components/PayMatchDashboard";
import { ClearScanMarker } from "@/components/ClearScanMarker";
import { PayMatchStart } from "@/components/PayMatchStart";
import { PayMatchErrorState } from "@/components/PayMatchErrorState";
import { getPayMatchEntitlement } from "@/lib/billing/entitlements";
import { ScanLimitExceededError, scanPayMatch } from "@/lib/paymatch/scan";
import { InstallationNotFoundError, TokenRefreshError } from "@/lib/ghl/session";
import { readInstallationSession } from "@/lib/security/installation-session";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function Home({ searchParams }: { searchParams?: Promise<SearchParams> | SearchParams } = {}) {
  const params = searchParams ? await searchParams : {};
  const session = firstParam(params.session);
  const shouldRunLiveScan = firstParam(params.scan) === "1" || firstParam(params.connected) === "1";
  const marketplaceUrl = payMatchMarketplaceUrl();
  let installationId: string | undefined;

  if (session) {
    try {
      installationId = readInstallationSession(session);
    } catch {
      return <PayMatchErrorState marketplaceUrl={marketplaceUrl} />;
    }
  }

  if (session && installationId && !shouldRunLiveScan) {
    const entitlement = await getPayMatchEntitlement(installationId);
    return <PayMatchStart session={session} entitlement={entitlement} marketplaceUrl={marketplaceUrl} />;
  }

  try {
    const scan = await scanPayMatch({
      installationId,
      locationId: firstParam(params.locationId),
      from: firstParam(params.from),
      to: firstParam(params.to)
    });
    const entitlement = installationId ? await getPayMatchEntitlement(installationId) : undefined;

    return (
      <>
        {installationId ? <ClearScanMarker /> : null}
        <PayMatchDashboard
          result={scan.result}
          mode={scan.mode}
          entitlement={entitlement}
          marketplaceUrl={marketplaceUrl}
          session={session}
        />
      </>
    );
  } catch (error) {
    if (session && installationId && error instanceof ScanLimitExceededError) {
      const entitlement = await getPayMatchEntitlement(installationId);
      return <PayMatchStart session={session} entitlement={entitlement} marketplaceUrl={marketplaceUrl} />;
    }
    if (error instanceof InstallationNotFoundError || error instanceof TokenRefreshError) {
      return <PayMatchErrorState marketplaceUrl={marketplaceUrl} />;
    }
    throw error;
  }
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function payMatchMarketplaceUrl(): string {
  const appId = process.env.GHL_APP_ID ?? "6a2080ce0162381848523c67";
  return `https://marketplace.gohighlevel.com/integration/${encodeURIComponent(appId)}`;
}
