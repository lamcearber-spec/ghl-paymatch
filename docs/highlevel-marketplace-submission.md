# PayMatch HighLevel Marketplace Submission

## Current State

- Production app URL: `https://ghl-paymatch.vercel.app/`
- OAuth callback URL: `https://ghl-paymatch.vercel.app/api/ghl/callback`
- Privacy URL: `https://ghl-paymatch.vercel.app/privacy`
- Terms URL: `https://ghl-paymatch.vercel.app/terms`
- Support URL: `https://ghl-paymatch.vercel.app/support`
- Support email: `support@konverter-pro.de`
- App assets:
  - `public/paymatch-logo-512.png`
  - `public/paymatch-preview-960x540.png`
  - `public/paymatch-preview-1-summary.png`
  - `public/paymatch-preview-2-tables.png`
  - `public/paymatch-preview-3-exports.png`

## App Identity

- App name: `PayMatch: Stripe Reconciliation for GHL`
- HighLevel app ID: `6a2080ce0162381848523c67`
- Submitted version/status: `1.0.0` / `review`
- Short name: `PayMatch`
- Category: Payments, Accounting, Reporting, or Finance/Operations if only one is allowed.
- Tagline: `Find GHL invoice and subscription revenue leaks before month-end close.`
- Short description: `Read-only Stripe reconciliation for GHL invoices, captured payments, unpaid active subscriptions, and amount mismatches.`

## Listing Description

PayMatch is a read-only reconciliation app for agencies and sub-accounts that need a fast month-end tie-out between HighLevel invoices, recorded payment transactions, and subscriptions.

The app highlights four revenue-control issues:

- Paid invoices with no matching captured transaction
- Captured Stripe/payment transactions with no closed invoice
- Active subscriptions whose latest payment failed or is past due
- Linked invoice and transaction records with amount or currency mismatches

PayMatch labels fuzzy matches as review, exports CSVs for each table, and keeps the workflow intentionally read-only. It never creates, edits, voids, refunds, or writes to invoices, payments, subscriptions, products, or contacts.

Best for agencies that want to catch unpaid retainers, orphaned charges, and month-end Stripe-to-GHL mismatches without giving a reconciliation tool write access to billing data.

## Search Keywords

`GHL Stripe reconciliation`, `HighLevel invoice reconciliation`, `Stripe tie-out`, `month-end close`, `unpaid subscriptions`, `revenue leakage`, `payment audit`, `invoice mismatch`, `captured charges`, `GHL payments report`

## Technical Configuration

- Target user: `Sub-account`
- Installable by: `Both Agency & Sub-account`
- Distribution while testing: `Private`
- Distribution for submission: `Public`
- App URL/custom page URL: `https://ghl-paymatch.vercel.app/`
- Redirect URL: `https://ghl-paymatch.vercel.app/api/ghl/callback`
- Webhooks: none for v1.
- External authentication: off for v1.

## Required Scopes

Use read scopes only:

- `invoices.readonly`
- `payments/transactions.readonly`
- `payments/subscriptions.readonly`
- `payments/orders.readonly`
- `contacts.readonly`
- `products.readonly`
- `products/prices.readonly`

Do not request write scopes.

## Pricing

Preferred HighLevel-native pricing:

- Free one-time scan or 14-day trial
- Starter: `$39/mo` for one location
- Pro: `$99/mo` for multi-location or agency use

If the form only permits one first plan, create Starter first and add Pro after the app is accepted or when pricing supports multiple plans.

## Reviewer Notes

PayMatch is intentionally read-only. It uses only HighLevel OAuth read scopes and stores OAuth tokens encrypted for installed accounts. Reconciliation data is read on demand and shown as operational evidence, not accounting, tax, legal, or payment-processing advice.

The production app includes fixture mode so reviewers can see the dashboard before installing with live test data. After OAuth install, the app redirects back with the installation ID and runs the same scan path against the installed location.

## Verification Before Submit

- Confirm the draft app is renamed from `vdraft` to PayMatch.
- Replace placeholder redirect URL with `https://ghl-paymatch.vercel.app/api/ghl/callback`.
- Confirm scopes are the seven read-only scopes above.
- Confirm app URL is `https://ghl-paymatch.vercel.app/`.
- Install the private app into a test sub-account.
- Run `/api/reconcile?installationId=<locationId>` or open `/?installationId=<locationId>` and confirm dashboard mode is `Live scan`.
- Download at least one CSV.
- Submit only after the private install flow works.
