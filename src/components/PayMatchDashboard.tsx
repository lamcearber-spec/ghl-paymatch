import { AlertTriangle, ArrowDownToLine, BadgeDollarSign, CircleCheckBig, Link2Off, Radar } from "lucide-react";
import { toPayMatchCsv, type PayMatchCsvKind } from "@/lib/reconcile/export";
import { TrackedCsvLink } from "@/components/TrackedCsvLink";
import type { PayMatchEntitlement } from "@/lib/billing/entitlements";
import type {
  ActiveSubFailedPaymentRow,
  AmountCurrencyMismatchRow,
  ChargeWithoutInvoiceRow,
  PaidWithoutChargeRow,
  ReconcileResult
} from "@/lib/reconcile/types";

type PayMatchDashboardProps = {
  result: ReconcileResult;
  mode: "fixture" | "live";
  entitlement?: PayMatchEntitlement;
  marketplaceUrl?: string;
  session?: string;
};

export function PayMatchDashboard({ result, mode, entitlement, marketplaceUrl, session }: PayMatchDashboardProps) {
  const tableCounts = [
    result.tables.paidWithoutCharge.length,
    result.tables.chargeWithoutInvoice.length,
    result.tables.activeSubFailedPayment.length,
    result.tables.amountCurrencyMismatch.length
  ];
  const totalFindings = tableCounts.reduce((sum, count) => sum + count, 0);

  return (
    <main className="shell">
      <section className="topbar" aria-label="PayMatch summary">
        <div>
          <p className="eyebrow">Stripe reconciliation</p>
          <h1>PayMatch</h1>
          <p className="subcopy">
            Read-only month-end tie-out for paid invoices, captured charges, unpaid active subscriptions, and linked
            amount mismatches.
          </p>
        </div>
        <div className="mode-pill" title={mode === "fixture" ? "Demo data is active until your account is connected." : "Live account data"}>
          <Radar size={16} aria-hidden="true" />
          {mode === "fixture" ? "Fixture scan" : result.summary.paginationComplete ? "Live scan" : "Partial scan"}
        </div>
      </section>

      <section className="metrics" aria-label="Scan totals">
        <Metric label="Revenue at risk" value={formatMoney(result.revenueAtRiskCents, result.currency)} tone="risk" />
        <Metric label="Findings" value={String(totalFindings)} tone="neutral" />
        <Metric label="Range" value={`${result.dateRange.from} to ${result.dateRange.to}`} tone="neutral" />
      </section>

      <section className="notice" aria-label="Read-only guarantee">
        <CircleCheckBig size={18} aria-hidden="true" />
        <span>Read-only by design. PayMatch labels fuzzy matches as review and never writes to invoices, payments, or subscriptions.</span>
      </section>

      <SourceCoverage result={result} />

      {result.summary.warnings.length > 0 ? (
        <section className="warning-panel" aria-label="Partial scan warning">
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            <strong>This report is partial</strong>
            {result.summary.warnings.map((warning) => <p key={warning}>{warning}</p>)}
          </div>
        </section>
      ) : null}

      {entitlement?.plan === "free" && entitlement.scansRemaining === 0 ? (
        <section className="upgrade-panel" aria-label="PayMatch upgrade">
          <div>
            <strong>Your free scan is complete.</strong>
            <p>Keep the report and exports above. Upgrade in HighLevel Marketplace when you need another live scan.</p>
          </div>
          <a className="primary-link" href={marketplaceUrl ?? "https://marketplace.gohighlevel.com"}>
            View PayMatch plans
          </a>
        </section>
      ) : null}

      <div className="table-grid">
        <PaidWithoutChargeTable rows={result.tables.paidWithoutCharge} currency={result.currency} session={session} />
        <ChargeWithoutInvoiceTable rows={result.tables.chargeWithoutInvoice} currency={result.currency} session={session} />
        <ActiveSubFailedPaymentTable rows={result.tables.activeSubFailedPayment} currency={result.currency} session={session} />
        <MismatchTable rows={result.tables.amountCurrencyMismatch} currency={result.currency} session={session} />
      </div>
    </main>
  );
}

function SourceCoverage({ result }: { result: ReconcileResult }) {
  const counts = result.summary.sourceCounts;
  return (
    <section className="source-coverage" aria-label="Source coverage">
      <span><strong>{counts.invoices}</strong> invoices fetched</span>
      <span><strong>{counts.transactions}</strong> transactions fetched</span>
      <span><strong>{counts.subscriptions}</strong> subscriptions fetched</span>
      <span><strong>{counts.contacts}</strong> contacts fetched</span>
      <span><strong>{counts.products}</strong> products fetched</span>
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: "risk" | "neutral" }) {
  return (
    <div className={`metric metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PaidWithoutChargeTable({ rows, currency, session }: { rows: PaidWithoutChargeRow[]; currency: string; session?: string }) {
  return (
    <TableShell
      title="Paid invoices without captured charge"
      icon={<AlertTriangle size={18} aria-hidden="true" />}
      rows={rows}
      csvName="paymatch-paid-without-charge.csv"
      csvKind="paidWithoutCharge"
      session={session}
    >
      <thead>
        <tr>
          <th>Invoice</th>
          <th>Customer</th>
          <th>Amount</th>
          <th>Status</th>
          <th>Why and next check</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.invoiceId}>
            <td>{row.invoiceNumber ?? row.invoiceId}</td>
            <td>{row.customerName}</td>
            <td>{formatMoney(row.amountCents, row.currency ?? currency)}</td>
            <td>
              <Badge tone={row.confidence}>{row.confidence}</Badge>
            </td>
            <ReasonCell reason={row.reason} next="Open the invoice and confirm its payment activity in HighLevel." />
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}

function ChargeWithoutInvoiceTable({ rows, currency, session }: { rows: ChargeWithoutInvoiceRow[]; currency: string; session?: string }) {
  return (
    <TableShell
      title="Captured charges without closed invoice"
      icon={<Link2Off size={18} aria-hidden="true" />}
      rows={rows}
      csvName="paymatch-charge-without-invoice.csv"
      csvKind="chargeWithoutInvoice"
      session={session}
    >
      <thead>
        <tr>
          <th>Charge</th>
          <th>Customer</th>
          <th>Amount</th>
          <th>Status</th>
          <th>Why and next check</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.transactionId}>
            <td>{row.providerChargeId ?? row.transactionId}</td>
            <td>{row.customerName}</td>
            <td>{formatMoney(row.amountCents, row.currency ?? currency)}</td>
            <td>
              <Badge tone={row.confidence}>{row.confidence}</Badge>
            </td>
            <ReasonCell reason={row.reason} next="Open the charge and candidate invoice before changing either record." />
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}

function ActiveSubFailedPaymentTable({ rows, currency, session }: { rows: ActiveSubFailedPaymentRow[]; currency: string; session?: string }) {
  return (
    <TableShell
      title="Active subscriptions with failed latest payment"
      icon={<BadgeDollarSign size={18} aria-hidden="true" />}
      rows={rows}
      csvName="paymatch-active-sub-failed-payment.csv"
      csvKind="activeSubFailedPayment"
      session={session}
    >
      <thead>
        <tr>
          <th>Subscription</th>
          <th>Customer</th>
          <th>Amount</th>
          <th>Payment</th>
          <th>Why and next check</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.subscriptionId}>
            <td>{row.serviceLabel ?? row.subscriptionId}</td>
            <td>{row.customerName}</td>
            <td>{formatMoney(row.amountCents, row.currency ?? currency)}</td>
            <td>
              <Badge tone="missing">{row.latestPaymentStatus ?? "failed"}</Badge>
            </td>
            <ReasonCell reason={row.reason} next="Open the subscription and confirm the latest retry or payment method." />
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}

function MismatchTable({ rows, currency, session }: { rows: AmountCurrencyMismatchRow[]; currency: string; session?: string }) {
  return (
    <TableShell
      title="Linked amount or currency mismatch"
      icon={<AlertTriangle size={18} aria-hidden="true" />}
      rows={rows}
      csvName="paymatch-linked-mismatch.csv"
      csvKind="amountCurrencyMismatch"
      session={session}
    >
      <thead>
        <tr>
          <th>Invoice</th>
          <th>Customer</th>
          <th>Invoice</th>
          <th>Charge</th>
          <th>Why and next check</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={`${row.invoiceId}-${row.transactionId}`}>
            <td>{row.invoiceNumber ?? row.invoiceId}</td>
            <td>{row.customerName}</td>
            <td>{formatMoney(row.invoiceAmountCents, row.invoiceCurrency ?? currency)}</td>
            <td>{formatMoney(row.transactionAmountCents, row.transactionCurrency ?? currency)}</td>
            <ReasonCell reason={row.reason} next="Compare the linked invoice currency and captured amount before closing the month." />
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}

function ReasonCell({ reason, next }: { reason: string; next: string }) {
  return (
    <td className="reason-cell">
      <span>{reason}</span>
      <small>{next}</small>
    </td>
  );
}

function TableShell<T extends Record<string, unknown>>({
  title,
  icon,
  rows,
  csvName,
  csvKind,
  session,
  children
}: {
  title: string;
  icon: React.ReactNode;
  rows: T[];
  csvName: string;
  csvKind: PayMatchCsvKind;
  session?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="table-panel">
      <div className="table-head">
        <h2>
          {icon}
          {title}
        </h2>
        <TrackedCsvLink className="csv-link" href={csvHref(csvKind, rows)} download={csvName} session={session}>
          <ArrowDownToLine size={15} aria-hidden="true" />
          Download CSV
        </TrackedCsvLink>
      </div>
      <div className="table-wrap">
        <table>{children}</table>
      </div>
    </section>
  );
}

function Badge({ children, tone }: { children: React.ReactNode; tone: "missing" | "review" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function csvHref(kind: PayMatchCsvKind, rows: Record<string, unknown>[]): string {
  return `data:text/csv;charset=utf-8,${encodeURIComponent(toPayMatchCsv(kind, rows as Record<string, string | number | boolean | null | undefined>[]))}`;
}

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(cents / 100);
}
