import { InfoPage } from "@/components/InfoPage";

export default function PrivacyPage() {
  return (
    <InfoPage eyebrow="PayMatch" title="Privacy Policy">
      <p>
        PayMatch is a read-only reconciliation app for invoices, payment transactions, and subscriptions. The app
        requests only read scopes needed to produce month-end discrepancy reports.
      </p>
      <p>
        PayMatch stores OAuth access and refresh tokens so installed accounts can run scans. In production, stored
        tokens are encrypted before being persisted. The app does not sell customer data and does not use reconciliation
        data for advertising.
      </p>
      <p>
        Reports may include customer names, invoice identifiers, subscription identifiers, transaction identifiers,
        amounts, currencies, and payment statuses. PayMatch does not write to invoices, payments, contacts, products,
        or subscriptions.
      </p>
      <p>Support and deletion requests: support@konverter-pro.de.</p>
    </InfoPage>
  );
}
