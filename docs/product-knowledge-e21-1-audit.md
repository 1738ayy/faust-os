# Phase E.21.1 — Product Knowledge Engine Verification Matrix

Status legend: Complete means implemented with tests. Partial means the model exists but live extraction still depends on page shape or provider data. Deferred means intentionally not built in this pass.

| Capability | Status | Implementation references | Test references | Notes |
| --- | --- | --- | --- | --- |
| Supplier name | Complete | `lib/product-knowledge.ts`, `types/superbuy-product.ts` | `tests/product-knowledge.test.ts` | Captured as raw evidence and cleaned display value. |
| Shop name cleanup | Complete | `cleanSupplierName()` in `lib/product-knowledge.ts` | `tests/product-knowledge.test.ts`, `tests/browser-extension-extractor.test.ts` | Removes Superbuy navigation chrome while preserving raw evidence. |
| Product title | Complete | `suggested_title` field | `tests/product-knowledge.test.ts` | Supplier title remains evidence-backed. |
| Product category | Complete | `product_type`, `universal_category`, `marketplace_category_candidates` | `tests/product-knowledge.test.ts` | Explicit supplier category outranks title inference. |
| Material / fabric composition | Complete | label aliases in `sourceLabelMappings` | `tests/product-knowledge.test.ts` | Handles English and Chinese labels; separates material and fabric composition. |
| RMB/source price | Complete | `pricePayload()` | `tests/product-knowledge.test.ts` | Preserves currency and tiers; converted display price is not treated as source truth. |
| Domestic shipping | Complete | `domestic_shipping` field | `tests/product-knowledge.test.ts` | Stored separately from international freight. |
| Weight and dimensions | Complete | `weight`, `dimensions` fields | `tests/product-knowledge.test.ts` | Explicit product weight has higher confidence than estimated packaged weight. |
| MOQ | Complete | `minimum_order_quantity` field | `tests/product-knowledge.test.ts` | First-class reviewable field. |
| Total stock | Complete | `stock` field | `tests/product-knowledge.test.ts` | Never uses sales or review count as stock. |
| Variant groups | Complete | `variantPayload()` | `tests/product-knowledge.test.ts` | Preserves Color/Size/localized labels when supplied. |
| Per-variant price and stock | Complete | `variant_options` field | `tests/product-knowledge.test.ts` | Rows and combinations carry price/stock. |
| Image URLs and ordering | Partial | `image_set` evidence | `tests/product-knowledge.test.ts` | Captures URL order and main flag; image quality scoring remains deferred. |
| Evidence storage | Complete | `product_knowledge_evidence` | `tests/production-connection.test.ts` | Immutable source records with normalized field hints. |
| Normalization | Complete | `sourceLabelMappings`, `categoryFact()` | `tests/product-knowledge.test.ts` | Label aliases are deterministic. |
| Confidence | Complete | `productKnowledgeConfidenceRules`, `upsertField()` | `tests/product-knowledge.test.ts` | Conflict penalty and review flags added. |
| Explanations | Complete | field-level explanation strings | Playwright product knowledge flow | Explanations distinguish evidence, memory, inference, and missing states. |
| Confirmations | Complete | `applyProductKnowledgeDecision()` | `tests/product-knowledge.test.ts` | User-confirmed values are authoritative for the Product. |
| Corrections | Complete | `applyProductKnowledgeDecision()`, memory creation policy | `tests/product-knowledge.test.ts` | Only safe reusable fields can create memory. |
| Rejections | Complete | status `rejected` and `productKnowledgeValue()` guard | `tests/product-knowledge.test.ts` | Rejected generated values do not immediately reappear. |
| Memory creation | Complete | `maybeCreateMemory()` | `tests/product-knowledge.test.ts` | Product-specific fields like title/weight/price do not become broad memory. |
| Memory reuse | Complete | `applyMemory()` | `tests/product-knowledge.test.ts` | Narrowest matching active memory wins. |
| Memory strengthening/weakening | Complete | `strengthenOrWeakenMemory()` | `tests/product-knowledge.test.ts` | Confirmations strengthen; repeated rejections suspend. |
| Memory review interface | Complete | `app/settings/product-knowledge/page.tsx` | Build/typecheck | Supports inspect, suspend, restore, and delete. |
| Completeness | Complete | `productKnowledgeCompleteness()` | `tests/product-knowledge.test.ts` | Deterministic categories with missing, low-confidence, conflict, and action fields. |
| Listings provenance | Complete | `lib/listings-core.ts` | `tests/product-knowledge.test.ts` | Draft mappings expose `productKnowledge.<field>`. |
| Regeneration safety | Partial | existing draft field override behavior | `tests/product-knowledge.test.ts` | Canonical knowledge is consumed by drafts; expanded sync-review scenarios remain a later hardening target. |
| Production persistence | Complete | migrations `029` and `030`, Supabase repository mapper | `tests/production-connection.test.ts` | Conflict/review/memory counters are normalized columns. |
| RLS | Complete | migration `029` policies inherited by altered tables | `tests/production-connection.test.ts` | New columns preserve existing table policies. |
| Repository parity | Complete | local JSON and Supabase normalized writer use same domain model | Unit tests + build | The same PKE service mutates both repository modes. |
| Hydration warning cleanup | Deferred | tracked cleanup | — | Product DNA hydration warning is unrelated to PKE and remains a separate follow-up unless it affects reliability. |

## Confidence formula

Faust uses a deterministic confidence hierarchy:

1. User-corrected or user-confirmed values are authoritative for that Product.
2. Explicit supplier attributes outrank title, navigation, image, and generic heuristics.
3. Corroborated values keep high confidence.
4. Active memory may raise confidence only when scope matches.
5. Conflicting evidence applies a penalty and marks the field for review.
6. Rejected values return no canonical value until corrected/reset/new evidence appears.

## Known limitations

- Image quality scoring and automatic best-cover selection are not part of E.21.1.
- Full marketplace draft sync-review UX for edited drafts is partially covered by existing draft override behavior, but deeper browser flows should be added before live connector work.
- Chinese label support is deterministic for the labels covered in tests; additional supplier page vocabulary should be added as fixtures appear.
