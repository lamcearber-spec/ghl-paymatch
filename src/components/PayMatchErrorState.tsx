import { AlertTriangle, ArrowRight } from "lucide-react";

export function PayMatchErrorState({ marketplaceUrl }: { marketplaceUrl: string }) {
  return (
    <main className="shell start-shell">
      <p className="eyebrow">Stripe reconciliation</p>
      <h1>PayMatch</h1>
      <section className="start-band error-band">
        <div>
          <AlertTriangle size={22} aria-hidden="true" />
          <div>
            <h2>Reconnect PayMatch</h2>
            <p>Your HighLevel authorization has expired or the installation was removed. Reconnect before scanning again.</p>
          </div>
        </div>
        <a className="primary-link" href={marketplaceUrl}>
          Open PayMatch in Marketplace <ArrowRight size={16} aria-hidden="true" />
        </a>
      </section>
    </main>
  );
}
