import { InfoPage } from "@/components/InfoPage";

export default function PrivacyPage() {
  return (
    <InfoPage eyebrow="PayMatch" title="Privacy Policy">
      <p>
        PayMatch is a read-only reconciliation app for invoices, payment transactions, and subscriptions. The app
        requests read-only business-data scopes needed to produce month-end discrepancy reports. HighLevel also
        requires the OAuth location-token permission when an agency installs PayMatch; that permission is used only
        to connect an approved sub-account and never to change business data.
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
      <p>
        Public agency guides may contain clearly disclosed HighLevel affiliate links tracked by FirstPromoter. PayMatch
        records only the selected plan, an allowlisted campaign source, and the click time for aggregate attribution;
        it does not add names, email addresses, IP addresses, or installation identifiers to that local click record.
        FirstPromoter and HighLevel may process referral data under their own privacy terms after you follow a link.
      </p>
      <p>Support and deletion requests: support@konverter-pro.de.</p>
    </InfoPage>
  );
}
