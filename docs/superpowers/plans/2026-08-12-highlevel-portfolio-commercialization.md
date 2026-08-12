# HighLevel Portfolio Commercialization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the five deployed HighLevel apps into a measurable product portfolio led by PayMatch, with InboxGuard as the acquisition product and compliant affiliate revenue as a separate secondary channel.

**Architecture:** Keep the five existing Next.js/Vercel applications independently deployable so their marketplace identities and review histories remain stable. Add the same small reliability, entitlement, event, and suite-navigation interfaces to each repository, beginning with PayMatch and InboxGuard. Use HighLevel native Marketplace pricing for app revenue and disclosed, SubID-tagged affiliate links only for appropriate public prospect journeys.

**Tech Stack:** Next.js App Router, TypeScript, Vitest, React Testing Library, Neon/Postgres, Vercel, HighLevel OAuth and Marketplace Billing APIs, Umami for public page analytics.

## Global Constraints

- Do not merge the five apps into a monorepo or change their HighLevel app IDs during rereview.
- Do not expose OAuth tokens, customer records, location IDs, or referral identities in analytics.
- Store OAuth tokens encrypted; fail closed when `INSTALLATION_SECRET` or `DATABASE_URL` is missing in production.
- Use HighLevel in-platform Marketplace pricing; do not add a parallel Stripe subscription flow.
- Keep affiliate and Marketplace app revenue separately attributed and reported.
- Show affiliate links only in disclosed public prospect content; do not force redirects, set referral cookies invisibly, or attempt to re-affiliate an existing customer.
- Every release must pass unit tests, typecheck, production build, OAuth install, token refresh, report generation, export, uninstall, and error-state smoke tests.

---

### Task 1: Recover Marketplace Distribution Status

**Files:**
- Modify: `docs/highlevel-marketplace-submission.md` in all five repositories
- Create: `docs/review-evidence/2026-08-rereview.md` in all five repositories

**Produces:** A current status, reviewer-feedback record, test-account procedure, and evidence bundle for each HighLevel app ID.

- [ ] Open each app in the HighLevel Developer Portal and record the exact version, review status, last reviewer message, and available action for these app IDs: AccessLens `6a2415931d5fcbfac6df50ba`, ConsentVault `6a2404d05cede604b98d23d0`, PayMatch `6a2080ce0162381848523c67`, InboxGuard `6a2422a5e000c98c74d179fe`, MemberAccessRecon `6a24693a01623812f16f0f86`.
- [ ] Confirm each production root, OAuth callback, privacy, terms, and support URL returns a successful response.
- [ ] Install every app into a controlled HighLevel test agency/location and capture the OAuth callback result and installation record.
- [ ] Generate the principal report and CSV/PDF export for every app against fixture mode and the controlled live installation.
- [ ] Confirm token refresh works and an uninstall removes or disables the installation without exposing stale data.
- [ ] Add screenshots, timestamps, expected reviewer steps, and any remaining platform-side failure to each evidence document.
- [ ] Send one concise consolidated follow-up referencing ticket `GHL-5689661`, while preserving any app-specific review tickets.
- [ ] Commit each repository's evidence separately with `docs: refresh HighLevel rereview evidence`.

**Exit gate:** Each app is either back in active review or has a specific, reproducible blocker assigned to HighLevel or Radom. Do not build commercial features around an unexplained review state.

### Task 2: Add the Shared Reliability Contract to PayMatch

**Files:**
- Create: `src/lib/observability/events.ts`
- Create: `src/lib/observability/events.test.ts`
- Create: `src/lib/ghl/session.ts`
- Create: `src/lib/ghl/session.test.ts`
- Create: `src/app/api/health/route.ts`
- Create: `src/app/api/health/route.test.ts`
- Create: `src/app/api/ghl/uninstall/route.ts`
- Create: `src/app/api/ghl/uninstall/route.test.ts`
- Modify: `src/lib/store/installations.ts`
- Modify: `src/lib/paymatch/scan.ts`
- Modify: `src/app/api/ghl/callback/route.ts`

**Interfaces:**
- Produces: `recordAppEvent(event: AppEvent): Promise<void>` with event names `install_completed`, `install_failed`, `scan_started`, `scan_completed`, `scan_failed`, `export_completed`, `token_refreshed`, and `uninstalled`.
- Produces: `getValidInstallation(id: string): Promise<MarketplaceInstallation>` that refreshes expired tokens and persists rotated credentials.
- Produces: `GET /api/health` returning deployment, database, and configuration readiness without secrets.

- [ ] Write tests proving production cannot silently fall back to in-memory installation storage.
- [ ] Write tests for token expiry, refresh-token rotation, refresh failure, and persisted replacement tokens.
- [ ] Add a minimal `app_events` table with app name, installation hash, event name, result, duration, and timestamp; never store HighLevel record payloads.
- [ ] Instrument OAuth, scans, exports, and failures with server-side events.
- [ ] Add a signed uninstall webhook route and mark the installation inactive or delete it according to the privacy policy.
- [ ] Add a health endpoint that distinguishes application availability from database/configuration readiness.
- [ ] Run `pnpm test`, `pnpm typecheck`, and `pnpm build`.
- [ ] Deploy PayMatch to Vercel and verify the complete controlled install-to-uninstall journey.
- [ ] Commit with `feat: harden PayMatch marketplace lifecycle`.

### Task 3: Make PayMatch the Commercial Hero

**Files:**
- Create: `src/lib/billing/entitlements.ts`
- Create: `src/lib/billing/entitlements.test.ts`
- Create: `src/app/api/billing/status/route.ts`
- Create: `src/app/api/billing/status/route.test.ts`
- Create: `src/lib/paymatch/pagination.test.ts`
- Modify: `src/lib/ghl/client.ts`
- Modify: `src/lib/reconcile/matcher.ts`
- Modify: `src/lib/reconcile/matcher.test.ts`
- Modify: `src/components/PayMatchDashboard.tsx`
- Modify: `src/components/PayMatchDashboard.test.tsx`
- Modify: `src/app/page.tsx`
- Modify: `docs/highlevel-marketplace-submission.md`

**Interfaces:**
- Produces: `getPayMatchEntitlement(installationId: string): Promise<{ plan: "free" | "starter" | "pro"; locationLimit: number; scansRemaining: number | null }>`.
- Produces: a deterministic reconciliation result that reports source counts, matched counts, mismatch counts, pagination completeness, and warnings.

- [ ] Add pagination tests covering more than one page of invoices, transactions, subscriptions, contacts, and products.
- [ ] Add fixture tests for paid invoice/no charge, charge/no closed invoice, unpaid active subscription, refund, duplicate charge, currency mismatch, amount mismatch, and fuzzy-match review.
- [ ] Add reconciliation completeness checks so partial API reads cannot be presented as complete reports.
- [ ] Implement HighLevel Marketplace entitlement lookup and cache only the plan state needed for access decisions.
- [ ] Configure native plans in the Developer Portal: one free scan, Starter `$39/month` for one location, and Pro `$99/month` for multiple locations with a 14-day trial.
- [ ] Redesign the primary journey as install/select location, run free scan, review recoverable value, export, then upgrade at the feature boundary.
- [ ] Keep fixture mode clearly labelled for reviewers and never mix fixture findings with live account findings.
- [ ] Add actionable result copy: the financial amount and records affected, why each item was flagged, and the next manual check.
- [ ] Run unit tests, typecheck, build, and a live test installation with deliberately mismatched fixture records.
- [ ] Deploy and verify free, Starter, Pro, expired-token, partial-API, and uninstall paths.
- [ ] Commit with `feat: launch PayMatch commercial workflow`.

**Exit gate:** At least ten controlled or real free scans complete without an unexplained error, and the first paid-plan checkout/entitlement flow is verified before promoting PayMatch broadly.

### Task 4: Turn InboxGuard Into the Free Acquisition Product

**Files:**
- Port the reliability contract files from Task 2 using InboxGuard-specific table and event names
- Create: `src/lib/billing/entitlements.ts`
- Create: `src/lib/billing/entitlements.test.ts`
- Create: `src/lib/inboxguard/snapshots.ts`
- Create: `src/lib/inboxguard/snapshots.test.ts`
- Create: `src/app/api/cron/domain-scan/route.ts`
- Create: `src/app/api/cron/domain-scan/route.test.ts`
- Modify: `src/lib/inboxguard/dns.ts`
- Modify: `src/lib/inboxguard/scan.ts`
- Modify: `src/components/InboxGuardDashboard.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Produces: a free scan for up to five locations and persisted snapshots containing only domain-authentication results and timestamps.
- Produces: a scheduled comparison that emits `domain_drift_detected` only when SPF, DKIM, or DMARC changes materially.

- [ ] Harden domain discovery and make manual domain entry explicit when HighLevel does not expose a sending domain.
- [ ] Store normalized SPF, DKIM, and DMARC snapshots and calculate drift from the preceding successful scan.
- [ ] Add a signed Vercel cron route for scheduled paid-plan scans and test replay/idempotency behavior.
- [ ] Configure native plans: free scan up to five locations, `$39/month` up to 25, `$79/month` up to 75, `$149/month` unlimited.
- [ ] Show the free report before the upgrade prompt; gate recurring monitoring, history, and larger portfolios.
- [ ] Add a contextual PayMatch cross-sell after a successful scan, without presenting it as part of the DNS finding.
- [ ] Run tests, typecheck, build, live DNS smoke tests against controlled domains, and the HighLevel install lifecycle.
- [ ] Deploy and commit with `feat: add InboxGuard monitoring and plans`.

### Task 5: Add a Consistent Suite Identity and Cross-App Attribution

**Files:**
- Create in each repo: `src/components/SuiteNav.tsx`
- Create in each repo: `src/components/SuiteNav.test.tsx`
- Create in each repo: `src/lib/attribution/source.ts`
- Create in each repo: `src/lib/attribution/source.test.ts`
- Modify in each repo: `src/app/layout.tsx`
- Modify in each repo: `src/app/page.tsx`
- Modify in each repo: `src/app/globals.css`

**Interfaces:**
- Produces: consistent links between PayMatch, InboxGuard, AccessLens, ConsentVault, and MemberAccessRecon with `source_app`, `source_surface`, and `campaign` query parameters.
- Produces: server events distinguishing marketplace installs, cross-sells, public content referrals, trials, and paid conversions.

- [ ] Define the portfolio label as `Radom Agency Operations for HighLevel`; keep each product name and app ID unchanged.
- [ ] Add a restrained suite navigation/footer and one relevant cross-sell per completed workflow.
- [ ] Add Umami page/action tracking and server-side commercial events using anonymous installation hashes.
- [ ] Build a portfolio funnel report with installs, activated installations, successful first scans, trial starts, paid plans, churn, affiliate clicks, affiliate trials, and affiliate customers.
- [ ] Verify attribution survives a normal public-page journey but does not store HighLevel customer data in Umami.
- [ ] Run visual and responsive checks across all five apps, plus unit tests, typecheck, and builds.
- [ ] Commit separately in each repository with `feat: connect HighLevel product suite`.

### Task 6: Add the Compliant Affiliate Funnel

**Files:**
- Create in PayMatch: `src/app/highlevel-for-agencies/page.tsx`
- Create in PayMatch: `src/app/highlevel-for-agencies/page.test.tsx`
- Create in PayMatch: `src/lib/affiliate/links.ts`
- Create in PayMatch: `src/lib/affiliate/links.test.ts`
- Modify in PayMatch: `src/app/privacy/page.tsx`
- Modify in PayMatch: `src/app/page.tsx`

**Interfaces:**
- Produces: `affiliateUrl(destination: "starter" | "unlimited" | "pro", subId: string): string` using portal-provided destinations and an allowlisted SubID.

- [ ] Restore and verify Agency Admin access to the HighLevel Affiliate Portal.
- [ ] Record the canonical portal-generated new-account and eligible upgrade links without storing them in source if HighLevel treats them as sensitive.
- [ ] Define SubIDs for PayMatch content, InboxGuard content, AccessLens content, organic search, email, and direct product cross-sell.
- [ ] Publish one useful comparison/implementation page for agencies evaluating HighLevel, with a conspicuous affiliate disclosure next to the recommendation.
- [ ] Show the affiliate CTA only in public prospect context; do not show a new-account referral CTA to an installed HighLevel customer.
- [ ] Add eligible upgrade guidance only where the upgrade is functionally relevant and use the official portal upgrade destination.
- [ ] Test malformed destinations, missing disclosure, unknown SubIDs, and installed-customer suppression.
- [ ] Reconcile affiliate portal results monthly by SubID and keep payouts separate from app subscriptions.
- [ ] Commit with `feat: add disclosed HighLevel affiliate funnel`.

### Task 7: Expand Only After PayMatch and InboxGuard Validate Demand

**Files:**
- Apply Tasks 2 and 5 to AccessLens, ConsentVault, and MemberAccessRecon
- Add app-specific billing entitlements and tests in each repository

- [ ] Require one of these gates before expanding: three PayMatch paying customers, 25 activated InboxGuard installations, or a documented HighLevel marketplace merchandising opportunity.
- [ ] Roll out AccessLens first with `$49/month`, `$99/month`, and a `$149` audit pack because it has the clearest agency compliance value.
- [ ] Roll out MemberAccessRecon second with a free sample, `$39/month` one-location, `$79/month` ten-location, and `$149/month` agency plan.
- [ ] Roll out ConsentVault last; validate whether customers prefer per-pack or subscription pricing before enabling both.
- [ ] Verify every paid feature against the native Marketplace entitlement and ensure uninstall/payment-failure behavior removes access cleanly.
- [ ] Keep separate activation and revenue metrics for every app; do not combine affiliate payouts with product MRR.

### Task 8: Operate and Measure the Portfolio

**Files:**
- Create: `docs/operations/highlevel-portfolio-runbook.md` in PayMatch
- Create: `docs/operations/highlevel-metrics.md` in PayMatch

- [ ] Define daily health checks for five roots, OAuth callbacks, database readiness, install failures, scan failures, and export failures.
- [ ] Define a weekly product report: listing status, installs, activated installs, successful first reports, trials, paid plans, MRR, churn, support messages, affiliate clicks, affiliate trials, affiliate customers, and commission payouts.
- [ ] Alert only on actionable failures or material funnel changes; do not create repetitive success notifications.
- [ ] Review failed scans using anonymized event metadata and reproduce only with controlled fixtures or customer data supplied for support.
- [ ] Review pricing and product allocation after 30 days. Continue investing in products with activation and retention; pause products that only attract fixture/reviewer traffic.

## Delivery Order and Expected Duration

1. Marketplace status and evidence: 1-2 working days.
2. PayMatch reliability and commercial workflow: 5-7 working days.
3. InboxGuard monitoring and acquisition workflow: 4-5 working days.
4. Suite identity, analytics, and affiliate funnel: 3-4 working days.
5. Remaining three products: only after the validation gate, approximately 2-4 working days each.

## First 30-Day Success Gates

- All five apps have an explicit Marketplace decision or a named reviewer/platform blocker.
- PayMatch records at least ten successful real or controlled scans, three trials, and one paid subscription.
- InboxGuard records at least 25 activated installations or five recurring-monitoring trials.
- Every affiliate link has a disclosure and SubID; affiliate results reconcile to portal reports.
- Zero silent OAuth failures, partial scans presented as complete, or production memory-store fallbacks.

