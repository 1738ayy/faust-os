# Phase E.20.1B Marketplace Intelligence Audit

## Architecture

```text
UniversalListingInput
  -> Marketplace Registry
  -> Versioned Marketplace Profile
  -> Field Mapper with provenance
  -> Draft Validator
  -> Marketplace Readiness
  -> Draft Inspector / connector payload preview
  -> Adapter, extension, or manual publishing workflow
```

## Directory structure

```text
lib/marketplace-intelligence/
  index.ts
  engine.ts
  registry.ts
  types.ts
  validation.ts
  readiness.ts
  mappings.ts
  versioning.ts
  capabilities.ts
  audit.ts
  fixtures.ts
  profiles/
    shared.ts
    depop/index.ts
    ebay/index.ts
    etsy/index.ts
    mercari/index.ts
    poshmark/index.ts
```

The previous single-file implementation is now only a compatibility re-export at `lib/marketplace-intelligence.ts`.

## Persistence and editability

- Marketplace system intelligence is currently static TypeScript.
- Profiles are not yet persisted in Supabase.
- Historical active profile versions are not yet persisted in database rows.
- Administrators can inspect profiles in Settings -> Marketplace Registry.
- Administrators cannot yet edit profiles in the UI.
- Draft profile activation is represented in code through `validateProfileForActivation()` and `activateProfileVersion()`, but durable admin editing/approval storage remains future work.
- User-editable account defaults are modeled separately from system rules in each profile, but are not yet persisted per workspace/account/category.

## Supported marketplaces and capabilities

| Marketplace | Version | Publish | Inventory | Price | Title | Photos | Description | Category | Orders |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Depop | 2.4.0 | adapter | yes | yes | yes | yes | yes | no | yes |
| eBay | 4.1.0 | adapter | yes | yes | yes | yes | yes | yes | yes |
| Etsy | 3.4.0 | extension | yes | yes | yes | yes | yes | no | yes |
| Mercari | 1.8.0 | extension | yes | yes | yes | yes | yes | no | no |
| Poshmark | 1.9.0 | extension | yes | yes | yes | yes | yes | no | no |

## Field definitions

Every profile defines executable field metadata for:

- `title`: required text, title limit comes from `contentRules`.
- `description`: required text, minimum 20 characters.
- `price`: required currency, marketplace-specific minimum.
- `category`: required single select, generated from stable universal category IDs.
- `condition`: required single select, translated through marketplace enum maps.
- `sku`: required text, sourced from physical SKU / variant SKU.
- `brand`: recommended text, product brand or marketplace default.
- `size`: conditionally required for clothing and shoes.
- `color`: recommended multi-select.
- `material`: recommended multi-select.
- `images`: required image field, marketplace-specific min/max rules.
- `weight`: conditionally required where shipping requires weight.

Each field includes data type, required state, conditional requirements, limits, accepted-value support, source preferences, override support, and validation messages.

## Category mapping coverage

Stable universal category IDs are mapped for:

- `apparel.tops.tshirts`
- `apparel.tops.hoodies`
- `apparel.bottoms.jeans`
- `apparel.shoes.sneakers`
- `jewelry.necklaces`
- `jewelry.bracelets`
- `bags.handbags`
- `collectibles.general`

Mappings support `verified`, `inferred`, `missing`, and `deprecated` states. Missing mappings do not silently become publish-ready; they lower readiness or block validation when a category is required.

## Enum mapping coverage

Explicit enum translation exists for:

- condition
- size
- color
- material
- style
- gender
- shipping service
- package type
- return policy

Universal labels are translated independently per marketplace before draft generation.

## Generated field provenance

Generated marketplace drafts now expose `generatedFields[]`.

Each generated field includes:

- field key
- value
- source: product, variant, marketplace default, user override, AI suggestion, or derived
- source path
- confidence
- warnings

The Marketplace Draft Inspector renders this provenance for a sample product.

## Readiness behavior

`MarketplaceReadinessResult` is calculated per marketplace.

It returns:

- score
- state: blocked, needs information, needs review, or ready
- blocking issues
- warnings
- recommendations

Missing required fields and invalid values block publishing. Recommended fields reduce readiness without blocking. Conditional fields such as size and weight are evaluated against category/shipping context.

## Fixture coverage

Fixture harness currently covers:

- 5 marketplaces
- 17 fixtures
- 85 generation scenarios
- 85 validation scenarios
- 85 readiness scenarios

Fixtures include T-shirt, hoodie, jeans, shoes, necklace, bracelet, handbag, collectible, variants, missing brand, missing size, one image, ten images, missing weight, marketplace override, invalid condition, and unsupported category.

## Hardcoded platform logic audit

The repository still contains platform names in intentional locations:

- Extension manifest, allowed origins, and marketplace content adapters.
- Marketplace route/navigation labels.
- Orders, finance, analytics, and Playwright filters where the user explicitly chooses a marketplace.
- Demo/staging fixture records.
- Connector adapters and extension selector definitions.
- Marketplace fee profile estimates.

Remaining shared listing logic intentionally keeps the channel loop in `lib/listings-core.ts`, but marketplace-specific draft rules are now loaded from MIE profiles. Two legacy repository locations still contain direct marketplace mapping for opportunity conversion and demo seed data; those are classified as migration/fixture paths, not the active cross-listing engine.

## What is verified vs assumed

Verified inside Faust:

- Schema completeness.
- Draft generation.
- Field provenance.
- Validation.
- Readiness.
- Image trimming warnings.
- Category/enum translation.
- Version diffing.
- Adapter validation using profiles.
- Existing Listings, extension import, and browser workflows remain green.

Assumed / not live-verified:

- Marketplace policy details are modeled from internal fixtures and known operating constraints, not live marketplace API schema downloads.
- Live API publish constraints are not credential-verified.
- User account defaults are modeled but not persisted per marketplace account yet.
- Admin profile editing and historical activation storage are not complete.

## Completion status

Marketplace Intelligence Engine is now a modular, executable knowledge system suitable to support the next Listings 2.0 publishing workspace.

Remaining before full live marketplace automation:

- Supabase persistence for marketplace profile versions.
- Admin draft/edit/activate workflow.
- Per-account and per-category default persistence.
- Live credential-backed marketplace schema verification.
- Connector payload normalization per live API.
