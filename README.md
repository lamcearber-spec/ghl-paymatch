# PayMatch: GHL Stripe Reconciliation

PayMatch is a read-only HighLevel Marketplace app for month-end reconciliation between GHL invoices, payment transactions, and subscriptions.

## Marketplace Positioning

**Suggested app name:** PayMatch: Stripe Reconciliation for GHL

**Short description:** Find paid GHL invoices without captured Stripe charges, captured charges without closed invoices, unpaid active subscriptions, and linked amount mismatches.

**Search terms to work into the listing:** GHL Stripe reconciliation, HighLevel invoice reconciliation, month-end close, unpaid subscriptions, revenue leakage, Stripe tie-out, payment audit, invoice mismatch.

**Pricing:** $39/mo single location, $99/mo Pro multi-location, free one-time scan, 14-day trial.

## Safe Scopes

- `invoices.readonly`
- `payments/transactions.readonly`
- `payments/subscriptions.readonly`
- `payments/orders.readonly`
- `contacts.readonly`
- `products.readonly`
- `products/prices.readonly`
- `oauth.readonly`
- `oauth.write`

All business-data access is read-only. HighLevel requires `oauth.write` only to exchange an agency installation token for an approved sub-account token; PayMatch never writes CRM, invoice, payment, product, or contact data.

## Local Development

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`. The dashboard uses fixture mode until HighLevel OAuth credentials are configured.

## Environment

Copy `.env.example` to `.env.local` and fill:

- `GHL_CLIENT_ID`
- `GHL_CLIENT_SECRET`
- `GHL_APP_ID`
- `GHL_REDIRECT_URI`
- `GHL_PAYMATCH_STARTER_PLAN_ID`
- `GHL_PAYMATCH_PRO_PLAN_ID`
- `GHL_PAYMATCH_PRO_LOCATION_LIMIT`
- `APP_BASE_URL`
- `INSTALLATION_SECRET`
- `DATABASE_URL`

If `DATABASE_URL` is set, PayMatch stores encrypted OAuth tokens in Neon/Postgres. Without it, development uses memory storage.

## HighLevel Setup

Create a public Marketplace app, target Sub-account, installable by both agency and sub-account. Configure the Custom Page URL to the deployed app root and the OAuth redirect URL to `/api/ghl/callback`.

Configure `https://paymatch-recon.vercel.app/api/ghl/webhook` as the webhook URL and subscribe it to App Install, App Update, App Uninstall, Plan Change, and App Payment Status. HighLevel signs those events and PayMatch persists only the selected plan, payment state, trial end, and free-scan usage needed for access decisions.

## Verification

```bash
pnpm test
pnpm typecheck
pnpm build
```
