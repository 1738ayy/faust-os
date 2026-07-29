# Faust Production Hardening RC Report

Date: 2026-07-29

This report covers the production-confidence pass after the Product Pipeline, connector platform, automation rules, and intelligence observability phases. The goal of this pass is not new capability; it is evidence that Faust can handle larger Product catalogs and operational workflows without hidden N+1 behavior, stale state, or obvious production-readiness gaps.

## Performance benchmark report

Measured locally with `npm run test:load` and the production-hardening harness.

| Workload | Result |
| --- | ---: |
| 1,000 Product Experience hydration | 190ms in focused test |
| 1,000 Product full production profile | 2.49s total |
| 10,000 Product full production profile | 13.98s total in load suite |
| 100,000 Product synthetic repository generation | 326ms |
| 10,000 Product heap used | 217 MB |
| 10,000 Product heap delta | 153 MB |

Key optimized path:

- Product Experience hydration no longer repeatedly scans the full Product workspace for every Product card.
- Product Intelligence relationship generation now reuses an indexed active-variant cache instead of rebuilding active variants per card.
- Catalog hydration uses indexed balances, drafts, listings, suppliers, purchase orders, lots, order items, movements, images, image quality, knowledge fields, visual observations, and image review decisions.
- Product-card contribution profit now computes the line contribution directly from the indexed order item instead of running full order reconciliation for every card.

The measured improvement was substantial:

- Before hardening: 1,000 Product Experience hydration was approximately 10.3 seconds.
- After hardening: the same focused workload is approximately 0.14–0.19 seconds.

## Workflow profile

Latest 1,000 Product profile:

| Operation | Count | Duration |
| --- | ---: | ---: |
| Synthetic data generation | 1,000 | 3.9ms |
| Product Knowledge generation | 200 | 707.5ms |
| Product import latency | 25 | 628.4ms |
| Repository hydration + Product Experience build | 1,025 | 568.2ms |
| Pipeline updates | 1,025 | 20.8ms |
| Action Center state sync | 725 | 122.1ms |
| Draft generation | 50 | 436.0ms |
| Marketplace publish path | 1 | 22.4ms |
| Automation execution | 1 | 1.9ms |
| Repository serialization | 1,025 | 54.3ms |

Latest 10,000 Product profile:

| Operation | Count | Duration |
| --- | ---: | ---: |
| Synthetic data generation | 10,000 | 22.9ms |
| Product Knowledge generation | 200 | 737.2ms |
| Product import latency | 25 | 2.76s |
| Repository hydration + Product Experience build | 10,025 | 4.67s |
| Pipeline updates | 10,025 | 166.8ms |
| Action Center state sync | 2,525 | 2.57s |
| Draft generation | 50 | 580.1ms |
| Marketplace publish path | 1 | 23.7ms |
| Automation execution | 1 | 0.5ms |
| Repository serialization | 10,025 | 176.9ms |

## Database optimization report

Migration audit:

- Migration files checked: 35
- Latest migration: `035_intelligence_observability_studio.sql`
- RLS enablement markers found: 60
- Latest intelligence observability migration has RLS and schema-cache reload.

Findings retained for review:

- `001_core_auth_and_tenancy.sql` predates the current index-audit convention and is flagged by the broad migration scanner for missing explicit index markers.
- `022_browser_extension_phase2.sql` is flagged by the broad scanner as having tables without direct foreign-key references in the same migration. This should be reviewed before production scale, but it is not a new regression in this pass.
- Several older migrations predate the current `notify pgrst, 'reload schema'` convention. Newer migrations should keep including schema-cache reloads.
- `011_fulfillment_transactional_operations.sql` contains destructive SQL text and should remain reviewed/documented as an intentional transactional cleanup/mutation migration before production rollout.

## Query optimization report

Optimized:

- Product Experience catalog hydration
- Product Intelligence relationship lookup
- Product-card order contribution calculation
- Product-card active Product/Variant filtering

Remaining watch areas:

- Action Center state sync becomes visible at 10,000 Products and should be profiled again after real production data has richer tasks/rules.
- Product import latency rises with repository size because import idempotency and lookup paths still operate over in-memory local repository collections. Production Supabase paths should use indexed source URL/import ID lookups.
- Visual/Product Knowledge generation is intentionally bounded in the load harness to avoid converting the load test into a full ML/inspection benchmark.

## Security audit summary

Security hardening checks:

- Public runtime secret leak scan: passed.
- Unsafe secret/token/password logging scan: passed.
- Production dependency audit: passed with `npm audit --omit=dev` reporting 0 vulnerabilities.
- API validation routes detected: 29.
- RLS enablement markers detected: 60.

Rules enforced:

- `NEXT_PUBLIC_*` names containing server-only indicators such as service-role, secret, private, or token are treated as leaks when assigned in runtime code/config.
- Test fixtures proving invalid public secret names are excluded from runtime leak reporting.
- Console logging patterns that include key/secret/token/password are treated as unsafe.
- Next was updated to `16.2.12`, with narrow npm overrides for `postcss@8.5.25` and `sharp@0.35.3` to clear production advisories without broad dependency forcing.

## Technical debt report

Current technical-debt scanner reports:

- Action markers: none from the hardening scanner itself.
- Legacy/workaround markers remain in older docs, tests, and compatibility modules.

Highest-priority cleanup candidates:

1. Consolidate legacy local Product-store paths after production Product persistence is fully stable.
2. Review older setup/staging docs for outdated instructions.
3. Keep connector SDK compatibility comments separated from user-facing release documentation.

## Load test results

`npm run test:load` passed:

- 1,000 Product operating workload
- 10,000 Product catalog hydration without exhausting memory
- 100,000 Product repository payload generation for capacity planning

The 100,000 Product test intentionally validates payload generation and memory posture, not full UI rendering or complete draft generation. Browser rendering at 100,000 Products should rely on virtualization/pagination and should be tested separately before allowing catalogs of that size in a single visible page.

## Production readiness checklist

- [x] Product Experience N+1 behavior addressed.
- [x] Product Intelligence relationship generation indexed.
- [x] Production hardening test harness added.
- [x] Load test harness added.
- [x] Migration audit added.
- [x] Security leak/logging audit added.
- [x] Technical debt audit added.
- [x] 1,000 and 10,000 Product workload profiles captured.
- [x] Production dependency audit cleared.
- [x] Run the full validation gate on the release branch.
- [ ] Verify Linux CI after push.
- [ ] Review flagged legacy migrations before final production rollout.
- [ ] Repeat staging profiling with real Supabase data and browser traces.

## Known limitations and recommended priorities

1. Real Supabase query plans still need staging measurement with production-like data volume. The local synthetic harness proves code-path scalability but cannot replace database `EXPLAIN ANALYZE`.
2. Browser rendering for very large catalogs should be kept virtualized/paginated. The current load test validates repository and service behavior, not infinite visible card rendering.
3. Connector live-site rate limits and marketplace throttling require controlled live-site testing; this pass only validates internal publish-path execution.
4. Older migrations should be normalized over time for consistent schema-cache reload and audit metadata conventions.
5. Product import idempotency and source lookup should be measured against indexed Supabase tables with at least 10,000 historical imports.

## Commands

Primary validation:

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run test:load
npm run build
```

Supplemental checks:

```bash
npm run production:migrations
npm audit --omit=dev
```
