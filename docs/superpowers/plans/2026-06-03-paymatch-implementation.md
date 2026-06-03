# PayMatch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only HighLevel Marketplace app that reconciles GHL invoices, subscriptions, and recorded payment transactions into month-end revenue discrepancy tables.

**Architecture:** Next.js App Router hosts the embedded dashboard, OAuth callback, and scan API. A pure TypeScript reconciliation engine owns matching and risk calculations so the money logic is testable without HighLevel credentials. HighLevel API and token storage are thin adapters around that core.

**Tech Stack:** Next.js, React, TypeScript, Vitest, Testing Library, Vercel-ready route handlers, Postgres-compatible token storage interface with local memory fallback.

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `.env.example`

- [x] **Step 1: Create build/test configuration**

Use Next.js App Router with scripts for `dev`, `build`, `test`, and `typecheck`.

### Task 2: Reconciliation Core

**Files:**
- Create: `src/lib/reconcile/types.ts`
- Create: `src/lib/reconcile/matcher.test.ts`
- Create: `src/lib/reconcile/matcher.ts`
- Create: `src/lib/reconcile/export.test.ts`
- Create: `src/lib/reconcile/export.ts`

- [ ] **Step 1: Write failing tests**

Cover four discrepancy classes: paid invoice without captured transaction, captured transaction without closed invoice, active subscription with failed latest payment, and linked amount/currency mismatch. Add CSV export tests for escaping and stable headers.

- [ ] **Step 2: Implement minimal pure functions**

Expose `reconcilePayMatch(input)` and `toCsv(rows)` with no network or storage calls.

### Task 3: HighLevel Shell

**Files:**
- Create: `src/lib/ghl/oauth.test.ts`
- Create: `src/lib/ghl/oauth.ts`
- Create: `src/lib/ghl/client.test.ts`
- Create: `src/lib/ghl/client.ts`
- Create: `src/lib/store/installations.ts`
- Create: `src/app/api/ghl/callback/route.ts`

- [ ] **Step 1: Write tests for OAuth URL, token exchange payloads, and pagination URL construction**

Require only readonly scopes and keep write scopes impossible from defaults.

- [ ] **Step 2: Implement OAuth helpers, API client, and callback route**

Store refresh tokens behind an installation store interface. In local/dev mode use memory storage.

### Task 4: Scan API and Dashboard

**Files:**
- Create: `src/app/api/reconcile/route.test.ts`
- Create: `src/app/api/reconcile/route.ts`
- Create: `src/components/PayMatchDashboard.test.tsx`
- Create: `src/components/PayMatchDashboard.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/layout.tsx`
- Create: `src/app/globals.css`

- [ ] **Step 1: Write tests for fixture-backed scan responses and dashboard rendering**

The dashboard must show revenue at risk, four discrepancy tables, review labels for fuzzy matches, and CSV links.

- [ ] **Step 2: Implement the route and dashboard**

Use fixtures when HighLevel tokens are not present so review and smoke testing do not block on credentials.

### Task 5: Marketplace Readiness

**Files:**
- Create: `README.md`
- Create: `public/favicon.svg`
- Create: `src/app/privacy/page.tsx`
- Create: `src/app/terms/page.tsx`
- Create: `src/app/support/page.tsx`

- [ ] **Step 1: Add listing copy and compliance pages**

Position around "GHL Stripe reconciliation", "month-end tie-out", and "unpaid subscriptions".

- [ ] **Step 2: Verify**

Run `pnpm test`, `pnpm typecheck`, `pnpm build`, and browser smoke test the local app.
