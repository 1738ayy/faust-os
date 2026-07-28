# Product Knowledge E.21.2 Quality Benchmark

Status: implemented as a focused verification checkpoint after `0054bdd`.

## Scope

This checkpoint does not add marketplace expansion. It verifies that Product Knowledge Engine v1 behaves like a restrained, evidence-backed assistant:

- explicit supplier evidence is preserved as immutable evidence;
- normalized knowledge is generated separately from raw source values;
- heuristic estimates stay lower confidence and reviewable;
- user decisions override generated values;
- reusable memory is inspectable, scoped, strengthened, weakened, and suspended;
- deferred visual intelligence remains clearly outside this benchmark.

## Benchmark dataset

The benchmark lives in `lib/product-knowledge-benchmark.ts` and includes 30 sanitized Superbuy/1688-style fixtures across:

- T-shirts
- Tops
- Jeans
- Shorts
- Jewelry
- Necklaces
- Bracelets
- Belts
- Handbags
- Accessories

The fixtures include complete metadata, incomplete metadata, mixed Chinese/English labels, ambiguous supplier names, tiered RMB prices, per-variant stock, duplicate-ish image sets, missing weight, and conflicting material signals.

## Metrics produced

`evaluateProductKnowledgeBenchmark()` reports:

- exact/acceptable extraction accuracy;
- missing-field precision;
- false-positive rate;
- variant preservation accuracy;
- supplier cleanup accuracy;
- category mapping accuracy;
- material normalization accuracy;
- price extraction accuracy;
- domestic shipping accuracy;
- weight accuracy;
- stock accuracy;
- confidence calibration buckets.

A correct `Unknown` is treated as better than an unsupported guess.

## User workflow hardening

The Product Workspace Product Knowledge panel now summarizes:

- percent understood;
- fields needing review;
- missing fields;
- conflicts;
- confirmed supplier facts;
- recommended primary action;
- safe high-confidence bulk approvals.

Each visible field exposes a compact evidence/history/impact disclosure without showing raw implementation JSON to normal users.

## Safety boundaries

Bulk approval excludes:

- conflicts;
- review-required values;
- low-confidence values;
- brand;
- condition;
- marketplace category candidates;
- generated descriptions/keywords/hashtags.

Corrections preserve manually edited marketplace fields and live listings; impact preview explains likely downstream effects before a high-impact correction becomes product behavior.

## CI anchor

Commit `0054bdd` was rechecked after GitHub recovered:

- Workflow: Inventory browser verification
- Run: `30328901155`
- Result: success

This checkpoint should produce a corrective successor commit with benchmark tests and UI/repository hardening.
