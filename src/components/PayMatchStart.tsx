import { ArrowRight, CircleCheckBig } from "lucide-react";
import type { PayMatchEntitlement } from "@/lib/billing/entitlements";

export function PayMatchStart({
  session,
  entitlement,
  marketplaceUrl
}: {
  session: string;
  entitlement: PayMatchEntitlement;
  marketplaceUrl: string;
}) {
  const canScan = entitlement.plan !== "free" || (entitlement.scansRemaining ?? 0) > 0;
  const scanUrl = `/?session=${encodeURIComponent(session)}&scan=1`;

  return (
    <main className="shell start-shell">
      <p className="eyebrow">Stripe reconciliation</p>
      <h1>PayMatch</h1>
      <section className="start-band">
        <div>
          <CircleCheckBig size={22} aria-hidden="true" />
          <div>
            <h2>Ready for another scan</h2>
            <p>
              {canScan
                ? "Your HighLevel connection is ready. Run a fresh read-only reconciliation when you need it."
                : "Your free live scan has been used. Choose a native Marketplace plan to run another reconciliation."}
            </p>
          </div>
        </div>
        {canScan ? (
          <a className="primary-link" href={scanUrl}>
            Run live scan <ArrowRight size={16} aria-hidden="true" />
          </a>
        ) : (
          <a className="primary-link" href={marketplaceUrl}>
            View PayMatch plans <ArrowRight size={16} aria-hidden="true" />
          </a>
        )}
      </section>
    </main>
  );
}
