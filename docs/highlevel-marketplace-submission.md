# PayMatch HighLevel Marketplace Submission

## Current State

- Production app URL: `https://paymatch-recon.vercel.app/`
- OAuth callback URL: `https://paymatch-recon.vercel.app/api/ghl/callback`
- Privacy URL: `https://paymatch-recon.vercel.app/privacy`
- Terms URL: `https://paymatch-recon.vercel.app/terms`
- Support URL: `https://paymatch-recon.vercel.app/support`
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
- App URL/custom page URL: `https://paymatch-recon.vercel.app/`
- Redirect URL: `https://paymatch-recon.vercel.app/api/ghl/callback`
- Webhook URL: `https://paymatch-recon.vercel.app/api/ghl/webhook`
- Webhook events: App Install, App Update, App Uninstall, Plan Change, App Payment Status
- External authentication: off for v1.

## Required Scopes

Use read-only business-data scopes plus HighLevel's location-token exchange permission:

- `invoices.readonly`
- `payments/transactions.readonly`
- `payments/subscriptions.readonly`
- `payments/orders.readonly`
- `contacts.readonly`
- `products.readonly`
- `products/prices.readonly`
- `oauth.readonly`
- `oauth.write`

`oauth.write` is required by HighLevel's v3 agency-to-location token endpoint. It does not grant PayMatch write access to contacts, invoices, payments, orders, subscriptions, products, or prices. Do not request any business-data write scope.

## Pricing

Preferred HighLevel-native pricing:

- Free one-time scan or 14-day trial
- Starter: `$39/mo` for one location
- Pro: `$99/mo` for multi-location or agency use

If the form only permits one first plan, create Starter first and add Pro after the app is accepted or when pricing supports multiple plans.

## Reviewer Notes

PayMatch is intentionally read-only for all business data. It stores OAuth tokens encrypted for installed accounts and uses `oauth.write` only to obtain an approved sub-account token after an agency installation. Reconciliation data is read on demand and shown as operational evidence, not accounting, tax, legal, or payment-processing advice.

The production app includes clearly labelled fixture mode so reviewers can see the dashboard before installing with live test data. After OAuth install, the app redirects back with an encrypted, expiring installation session and a one-time scan marker. The marker is removed after the report loads, so a browser refresh never consumes another free scan.

Live reports disclose source counts and pagination completeness. If a later HighLevel API page fails, PayMatch labels the report partial and names the affected source instead of presenting incomplete data as a complete reconciliation.

## Verification Before Submit

- Confirm the draft app is renamed from `vdraft` to PayMatch.
- Replace placeholder redirect URL with `https://paymatch-recon.vercel.app/api/ghl/callback`.
- Confirm scopes are the eight read-only scopes plus `oauth.write` above.
- Configure the five signed webhook events on `/api/ghl/webhook`.
- Enter the native Starter and Pro plan IDs in the matching Vercel environment variables.
- Confirm app URL is `https://paymatch-recon.vercel.app/`.
- Install the private app into a test sub-account.
- Complete the OAuth test install and use the encrypted `session` URL returned by the callback to confirm dashboard mode is `Live scan`. Raw location IDs are not accepted as browser authorization.
- Download at least one CSV.
- Submit only after the private install flow works.
