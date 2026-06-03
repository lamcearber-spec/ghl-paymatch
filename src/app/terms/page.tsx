import { InfoPage } from "@/components/InfoPage";

export default function TermsPage() {
  return (
    <InfoPage eyebrow="PayMatch" title="Terms of Service">
      <p>
        PayMatch provides read-only reconciliation evidence for operational review. It is not accounting, tax, legal, or
        payment-processing advice.
      </p>
      <p>
        Findings are based on available HighLevel invoice, payment transaction, contact, and subscription records.
        Fuzzy matches are labeled as review and should be verified by the merchant or agency before any accounting
        action is taken.
      </p>
      <p>
        PayMatch does not modify HighLevel data. Users remain responsible for validating reports against their source
        systems and books of record.
      </p>
      <p>Support: support@konverter-pro.de.</p>
    </InfoPage>
  );
}
