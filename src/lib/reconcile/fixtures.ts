import { reconcilePayMatch } from "./matcher";
import type { ReconcileInput } from "./types";

export const demoPayMatchInput: ReconcileInput = {
  dateRange: { from: "2026-05-01", to: "2026-05-31" },
  contacts: [
    { id: "contact-1", name: "Northstar Dental", email: "billing@northstar.test" },
    { id: "contact-2", name: "Ledger Lane Studio", email: "ops@ledgerlane.test" },
    { id: "contact-3", name: "Mitte Growth Lab", email: "finance@mitte.test" }
  ],
  invoices: [
    {
      id: "inv-missing",
      number: "INV-1007",
      contactId: "contact-1",
      status: "paid",
      totalCents: 12000,
      currency: "USD",
      paidAt: "2026-05-22T10:00:00.000Z",
      createdAt: "2026-05-20T10:00:00.000Z"
    },
    {
      id: "inv-mismatch",
      number: "INV-1008",
      contactId: "contact-1",
      status: "paid",
      totalCents: 5000,
      currency: "USD",
      transactionIds: ["txn-mismatch"],
      paidAt: "2026-05-22T10:00:00.000Z",
      createdAt: "2026-05-20T10:00:00.000Z"
    },
    {
      id: "inv-review",
      number: "INV-1012",
      contactId: "contact-2",
      status: "paid",
      totalCents: 7777,
      currency: "USD",
      paidAt: "2026-05-11T09:00:00.000Z",
      createdAt: "2026-05-10T09:00:00.000Z"
    }
  ],
  transactions: [
    {
      id: "txn-orphan",
      contactId: "contact-3",
      status: "captured",
      amountCents: 9900,
      currency: "USD",
      createdAt: "2026-05-23T10:00:00.000Z",
      providerChargeId: "ch_orphan"
    },
    {
      id: "txn-mismatch",
      invoiceId: "inv-mismatch",
      contactId: "contact-1",
      status: "captured",
      amountCents: 5500,
      currency: "USD",
      createdAt: "2026-05-22T10:05:00.000Z",
      providerChargeId: "ch_mismatch"
    },
    {
      id: "txn-review",
      contactId: "contact-2",
      status: "succeeded",
      amountCents: 7777,
      currency: "USD",
      createdAt: "2026-05-12T09:00:00.000Z",
      providerChargeId: "ch_review"
    }
  ],
  subscriptions: [
    {
      id: "sub-failed",
      contactId: "contact-1",
      status: "active",
      latestPaymentStatus: "failed",
      amountCents: 4500,
      currency: "USD",
      serviceLabel: "Monthly retainer"
    }
  ]
};

export const demoPayMatchResult = reconcilePayMatch(demoPayMatchInput);
