import { AlertTriangle, RotateCcw } from "lucide-react";

export function PayMatchScanErrorState({ session }: { session: string }) {
  const retryUrl = `/?session=${encodeURIComponent(session)}&scan=1`;

  return (
    <main className="shell start-shell">
      <p className="eyebrow">Stripe reconciliation</p>
      <h1>PayMatch</h1>
      <section className="start-band error-band">
        <div>
          <AlertTriangle size={22} aria-hidden="true" />
          <div>
            <h2>Scan could not complete</h2>
            <p>
              HighLevel did not return every source needed for this reconciliation. The failed attempt was not counted.
            </p>
          </div>
        </div>
        <a className="primary-link" href={retryUrl}>
          Try the scan again <RotateCcw size={16} aria-hidden="true" />
        </a>
      </section>
    </main>
  );
}
