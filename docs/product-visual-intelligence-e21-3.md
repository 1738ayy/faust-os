# Phase E.21.3 — Visual Product Understanding and Category Intelligence v1

## Status

Phase E.21.3 adds the first visual-evidence layer to the Product Knowledge Engine. Faust can now inspect persisted Product image records, create image-derived observations, score image quality dimensions separately, recommend a cover image, surface category candidates, preserve review decisions, and route approved image-supported facts through canonical Product Knowledge before marketplace drafts consume them.

The implementation is deliberately conservative. Image intelligence is supporting evidence, not canonical truth. It can request review, corroborate weak metadata, and improve readiness signals, but it does not silently overwrite supplier facts, user confirmations, or user corrections.

## CI baseline

The required previous checkpoint commit `26f8e17` was green in Linux CI:

- GitHub Actions run: https://github.com/1738ayy/faust-os/actions/runs/30341073761

## Category failure analysis

The prior benchmark had a visible category weakness around the 80% baseline. The recurring causes were:

- taxonomy gaps for generic tops, sweatshirts, shorts, jewelry, belts, handbags, and general accessories;
- fixture expectation mismatch where `Bags > Shoulder Bags` expected generic `Bags` even after the taxonomy gained `Handbag`;
- ambiguous source labels such as `Blouse` when the product title/image structure suggested `T-shirt`.

The fix was made at the taxonomy/normalization layer, not by isolated fixture hardcoding.

## Taxonomy changes

`lib/marketplace-intelligence/mappings.ts` now defines stable universal category profiles with:

- stable ID;
- display name;
- parent;
- aliases;
- expected attributes;
- likely variant groups;
- marketplace mapping hooks;
- related categories;
- disambiguation signals;
- common confusions.

New/expanded categories include:

- `apparel.tops.general`
- `apparel.tops.sweatshirts`
- `apparel.bottoms.shorts`
- `jewelry.general`
- `accessories.belts`
- `accessories.general`

## Image evidence schema

New normalized persistence tables:

- `product_image_observations`
- `product_image_quality`
- `product_cover_recommendations`
- `product_image_review_decisions`

The corresponding domain records store image ID, observation type, value, confidence, explanation, evidence reference/region where available, provider/model version, timestamps, review decisions, and cover recommendation status.

## Cover ranking

The cover recommender considers:

- product visibility;
- resolution;
- lighting;
- cropping;
- background distraction;
- watermark risk;
- obstruction;
- marketplace suitability;
- detected role.

Size charts and detail-only images are explicitly prevented from outranking clean cover candidates. Near duplicates are preserved but demoted. Users can approve the recommended cover or choose a different cover; the override is persisted.

## Duplicate and image-role detection

V1 detects near duplicates using stable normalized source identity and classifies roles such as:

- cover candidate;
- gallery;
- detail;
- size chart;
- excluded.

Duplicates are never deleted automatically.

## Product Workspace integration

The Product Workspace now includes a focused “Visual Intelligence” section showing:

- image-backed evidence explanation;
- recommended cover and confidence;
- category candidates and conflicts;
- image-review controls for size chart, detail-only, and exclusion.

The normal UI avoids raw model internals. The implementation preserves technical observability in persisted records.

## Completeness and readiness integration

Visual intelligence now affects Product readiness through the central readiness service:

- unusable cover images can block cover-image readiness;
- supplier/image category conflicts can block marketplace-category readiness until reviewed;
- image signals do not mutate canonical Product fields.

## Draft integration

Marketplace drafts do not call image intelligence directly. Approved category knowledge flows through canonical Product Knowledge as a `user_decision`, and draft provenance continues to report Product/knowledge-derived sources rather than a separate image-truth path.

## Measured results

Local benchmark after this pass:

- Product Knowledge fixtures: 30
- Field checks: 330
- Exact/acceptable accuracy: 100%
- Category mapping accuracy: 100% after handbag expectation alignment
- Variant preservation: 100%
- Unsafe brand inference: 0%
- Unsupported exact-material claims: 0%

Visual-intelligence unit coverage verifies:

- image evidence storage;
- separate quality dimensions;
- cover ranking and override persistence;
- duplicate grouping without deleting source images;
- supplier/image category conflict;
- user-decision precedence;
- draft consumption through canonical Product Knowledge;
- readiness impact;
- brand restraint;
- material restraint.

Browser coverage verifies:

- import with multiple images;
- Product Workspace Visual Intelligence panel;
- recommended cover review;
- category candidate approval;
- size-chart exclusion;
- refresh/persistence via repository state;
- canonical Product Knowledge update with `user_decision`.

## Known limitations

This is v1 visual intelligence. It is deterministic and uses persisted image metadata, source URLs, alt text, purpose labels, and stable source identity as observable signals. It does not yet run a live computer-vision provider or true pixel-level image recognition. That is intentional until provider credentials, cost controls, and review workflows are ready.

Because of that, the current engine can safely reason about explainable signals such as filenames, source roles, duplicate identity, likely size charts, and detail shots. It should not be represented as a full image-understanding model.

Unknown/review-required remains a valid result.
