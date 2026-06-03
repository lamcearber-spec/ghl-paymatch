import { AlertTriangle, ArrowDownToLine, BadgeDollarSign, CircleCheckBig, Link2Off, Radar } from "lucide-react";
import { toCsv } from "@/lib/reconcile/export";
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
};

export function PayMatchDashboard({ result, mode }: PayMatchDashboardProps) {
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
          {mode === "fixture" ? "Fixture scan" : "Live scan"}
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

      <div className="table-grid">
        <PaidWithoutChargeTable rows={result.tables.paidWithoutCharge} currency={result.currency} />
        <ChargeWithoutInvoiceTable rows={result.tables.chargeWithoutInvoice} currency={result.currency} />
        <ActiveSubFailedPaymentTable rows={result.tables.activeSubFailedPayment} currency={result.currency} />
        <MismatchTable rows={result.tables.amountCurrencyMismatch} currency={result.currency} />
      </div>
    </main>
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

function PaidWithoutChargeTable({ rows, currency }: { rows: PaidWithoutChargeRow[]; currency: string }) {
  return (
    <TableShell
      title="Paid invoices without captured charge"
      icon={<AlertTriangle size={18} aria-hidden="true" />}
      rows={rows}
      csvName="paymatch-paid-without-charge.csv"
    >
      <thead>
        <tr>
          <th>Invoice</th>
          <th>Customer</th>
          <th>Amount</th>
          <th>Status</th>
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
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}

function ChargeWithoutInvoiceTable({ rows, currency }: { rows: ChargeWithoutInvoiceRow[]; currency: string }) {
  return (
    <TableShell
      title="Captured charges without closed invoice"
      icon={<Link2Off size={18} aria-hidden="true" />}
      rows={rows}
      csvName="paymatch-charge-without-invoice.csv"
    >
      <thead>
        <tr>
          <th>Charge</th>
          <th>Customer</th>
          <th>Amount</th>
          <th>Status</th>
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
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}

function ActiveSubFailedPaymentTable({ rows, currency }: { rows: ActiveSubFailedPaymentRow[]; currency: string }) {
  return (
    <TableShell
      title="Active subscriptions with failed latest payment"
      icon={<BadgeDollarSign size={18} aria-hidden="true" />}
      rows={rows}
      csvName="paymatch-active-sub-failed-payment.csv"
    >
      <thead>
        <tr>
          <th>Subscription</th>
          <th>Customer</th>
          <th>Amount</th>
          <th>Payment</th>
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
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}

function MismatchTable({ rows, currency }: { rows: AmountCurrencyMismatchRow[]; currency: string }) {
  return (
    <TableShell
      title="Linked amount or currency mismatch"
      icon={<AlertTriangle size={18} aria-hidden="true" />}
      rows={rows}
      csvName="paymatch-linked-mismatch.csv"
    >
      <thead>
        <tr>
          <th>Invoice</th>
          <th>Customer</th>
          <th>Invoice</th>
          <th>Charge</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={`${row.invoiceId}-${row.transactionId}`}>
            <td>{row.invoiceNumber ?? row.invoiceId}</td>
            <td>{row.customerName}</td>
            <td>{formatMoney(row.invoiceAmountCents, row.invoiceCurrency ?? currency)}</td>
            <td>{formatMoney(row.transactionAmountCents, row.transactionCurrency ?? currency)}</td>
          </tr>
        ))}
      </tbody>
    </TableShell>
  );
}

function TableShell<T extends Record<string, unknown>>({
  title,
  icon,
  rows,
  csvName,
  children
}: {
  title: string;
  icon: React.ReactNode;
  rows: T[];
  csvName: string;
  children: React.ReactNode;
}) {
  return (
    <section className="table-panel">
      <div className="table-head">
        <h2>
          {icon}
          {title}
        </h2>
        <a className="csv-link" href={csvHref(rows)} download={csvName}>
          <ArrowDownToLine size={15} aria-hidden="true" />
          Download CSV
        </a>
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

function csvHref(rows: Record<string, unknown>[]): string {
  return `data:text/csv;charset=utf-8,${encodeURIComponent(toCsv(rows as Record<string, string | number | boolean | null | undefined>[]))}`;
}

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(cents / 100);
}
