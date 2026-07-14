# Repository audit

Audited: 2026-07-14

## Executed validation

The final clean-copy validation used a new directory with no existing `node_modules`:

| Command | Result |
| --- | --- |
| `npm ci --legacy-peer-deps` | Passed. |
| `npm run lint` | Passed with no warnings. |
| `npm run typecheck` | Passed. |
| `npm test` | Passed: calculation, operational workflow, tenancy role, inventory state, and local/RPC contract tests. |
| `npm run test:e2e` | Not passed locally. Playwright discovered four browser specifications, but the sandbox denied Chromium process launch (`spawn EPERM`); Linux CI installs Chromium and runs this command. |
| `npm run build` | Passed; 29 application routes compiled. |

The portable delivery archive was directly extracted into a clean directory and passed `npm ci --legacy-peer-deps`, lint, typecheck, unit/contract tests, the TypeScript journey test, and production build from that extracted directory. The ZIP has only forward-slash entry paths. A Linux runtime was unavailable in this workspace (no WSL distribution and inaccessible Docker daemon), so this is not represented as a Linux execution.

No Google Font download is used during the production build.

## Implemented internal foundations

- Supabase SSR clients, proxy refresh, callback, protected routes, sign out, and recovery/update-password screens.
- Active business selection validates membership server-side; the cookie is only a preference.
- Transactional `create_business_with_defaults` RPC creates a business, owner membership, settings, default warehouse, and initial operating configuration.
- Versioned migrations `001`–`003` define the core and extended normalized tenant tables, indexes, foreign keys, constraints, idempotency fields, and RLS policies.
- Production operating reads map normalized Supabase records. Order transitions and parcel receiving use targeted normalized record mutations, movement inserts, status events, and activity events; local JSON remains only for disabled-auth development mode.
- Orders now own explicit line items. Reservation and shipment validate every item’s balance; shipment does not clamp unavailable inventory.
- Parcel receiving uses explicit parcel/PO item rows and supports partial received, damaged, missing, rejected, and overage quantities.
- Marketplace, shipping, tracking, and AI adapter interfaces include truthful manual/deterministic fallbacks.
- Setup, architecture, security, finance, inventory, shipping, marketplace, deployment, and user documentation are included in `docs/`.

## Deliberately unverified external behavior

## Inventory completion status

- Migration `004_inventory_transactional_mutations.sql` adds targeted `mutate_inventory_balance` and `transfer_inventory_balance` RPCs. They lock the affected records, enforce tenant role and usable-stock rules, create immutable movement plus activity records, and rely on PostgreSQL transaction rollback for all-or-nothing behavior.
- The production inventory repository calls these RPCs rather than the normalized whole-workspace writer. Local development retains the JSON adapter only as a fallback.
- Dedicated inventory controls exist for adjustment, transfer, cycle count, damage, quarantine, quarantine release, loss, found stock, and location assignment. The Inventory detail view displays state by location alongside linked records, movements, and activity.
- Unit/contract tests passed locally. The Playwright browser suite was attempted on 2026-07-14; all four tests were discovered but this sandbox denied Chromium launch (`spawn EPERM`). `.github/workflows/inventory-browser.yml` installs Chromium and runs that suite on Ubuntu. Browser verification is therefore pending a successful CI or supported-environment run.

This workspace has no configured Supabase project, Auth redirect configuration, test users, marketplace approvals, carrier credentials, tracking credentials, or AI credentials. Therefore the following are implemented but **not represented as live-verified**:

- Applying migrations and executing the onboarding RPC in a real project.
- Actual RLS cross-business/role denial queries.
- Expired-session refresh, email verification, password-recovery email delivery, and invalid-token handling through Supabase Auth.
- Marketplace publish/import, carrier rate/label calls, tracking polling, and provider-backed AI.

The local server route inspection could not be started in this sandbox because background-process approval is disabled. The clean production build enumerated all 24 routes successfully.

Playwright specifications are included and `npm run test:e2e` is wired to the real Playwright runner. The required Chromium runtime could not be installed in this sandbox because its browser-cache location is permission-restricted; run `npx playwright install chromium` in a normal developer or CI environment before executing the browser suite.

## Dependency audit

`npm audit --omit=dev` reports two moderate findings: the direct `next@16.2.10` dependency currently bundles a vulnerable `postcss` version below 8.5.10 (GHSA-qx2v-qp2m-jg93). npm reports no non-breaking automatic fix. This is an upstream framework dependency; upgrade Next.js when a compatible release resolves the advisory, then rerun the full validation suite. No `npm audit fix --force` was applied because it could introduce an unreviewed breaking framework change.

## External connection steps remaining

1. Enter Supabase URL/anon key in `.env.local`, apply migrations in order, set `NEXT_PUBLIC_FAUST_AUTH_ENABLED=true`, and configure Auth redirects.
2. Provision non-production test users for owner/admin/operations/fulfillment/finance/viewer and execute live RLS/session checks.
3. Supply marketplace approval/credentials, then implement provider-specific adapters behind the included marketplace contract.
4. Supply EasyPost or Shippo, 17TRACK, and AI credentials if those services are wanted.
5. Configure the extension’s endpoint and host permissions, then install it in the browser.
