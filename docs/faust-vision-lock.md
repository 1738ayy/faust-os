# FAUST Vision Lock

Faust is not a listing tool, an inventory tool, or an analytics dashboard.

Faust is an Autonomous Commerce Operating System. Its purpose is to understand every product a seller owns, intelligently prepare it for every marketplace, automate repetitive operational work, and help the seller make better decisions.

Every future feature should strengthen at least one of these pillars:

- Product Intelligence
- Marketplace Intelligence
- Operational Automation
- Business Intelligence

If a feature does not reinforce one of those pillars, question it before implementation.

## Guiding philosophy

The user should never feel like they are manually creating listings. The intended experience is:

1. I add a Product.
2. Faust understands it.
3. Faust prepares it.
4. Faust asks me only what it cannot determine.
5. I approve.
6. Faust handles the rest.

The long-term operating principle is:

> Approve instead of Create.

Every workflow should reduce manual work over time without hiding risk, source evidence, or user control.

## Vision 1: Product Knowledge Engine

Products are intelligent digital objects and the central source of truth for Faust. Listings are marketplace-specific projections of one Product; they must never become the source of truth.

### Product understanding pipeline

```text
Import Product
-> collect metadata
-> analyze images
-> analyze text
-> extract attributes
-> estimate missing values
-> determine confidence
-> generate canonical Product
-> generate marketplace drafts
```

Every stage should produce reusable knowledge.

### Product intelligence modules

Faust should progressively understand:

- Identity: brand, manufacturer, collection, product line, model, SKU, UPC, internal SKU.
- Classification: universal category, marketplace category candidates, gender, age group, season, product type, style.
- Physical attributes: color, material, fabric, finish, pattern, shape, texture.
- Clothing intelligence: size, fit, measurements, sleeve type, neckline, rise, waist, inseam.
- Accessory intelligence: stone, metal, finish, chain type, strap type, closure.
- Condition analysis: new, excellent, very good, good, fair, plus stains, holes, scratches, fading, discoloration, and missing parts.
- Image intelligence: best cover photo, duplicate photos, blurry/dark images, missing angles, unnecessary photos, and recommended fixes.
- Text intelligence: titles, descriptions, keywords, hashtags, and feature bullets.
- Pricing intelligence: minimum price, expected market price, premium price, quick-sale price, and confidence.
- Shipping intelligence: package size, weight, shipping class, and carrier recommendations.

Generated values must never silently overwrite user edits.

### Confidence model

Every generated value should expose:

- value
- confidence
- source
- whether it was generated or user-edited
- applied defaults
- overrides
- validation state
- history

Example:

```text
Material: Cotton
Confidence: 61%
Source: Description inference
```

### Product completeness

Each Product should communicate completeness as structured operational quality:

- Identity
- Attributes
- Images
- Pricing
- Shipping
- Marketplace readiness

Faust should guide users toward systematic Product quality instead of scattered warnings.

## Vision 2: Depop Production Connector

Build one production-quality connector before expanding horizontally. Depop is the reference implementation for future connectors.

The Depop connector should support:

- authentication
- account management
- draft creation
- draft publishing
- image upload
- listing updates
- inventory sync
- price updates
- listing pause/end/relist
- listing health and status
- rate limiting
- retry
- webhook or event handling where available
- audit logs
- connector diagnostics

Marketplace Intelligence owns marketplace rules. Connectors own transport.

Every publish should store:

- payload
- response
- duration
- attempts
- errors
- connector version
- marketplace profile version

Every connector should support dry run:

```text
Generate payload -> validate payload -> simulate publish -> real publish
```

Do not connect live credentials until dry-run and diagnostic behavior are trustworthy.

## Vision 3: Bulk Operations Engine

One-Product workflows must scale to thousands of Products without changing the user's mental model.

Bulk workflows should support:

- product review for titles, descriptions, pricing, categories, images, shipping, and readiness
- readiness fixes such as applying a jewelry weight default to all affected Products
- pricing changes by category, brand, marketplace, or readiness state
- marketplace selection, such as publishing all ready Products to Depop and Mercari while skipping blocked Products
- image review for duplicate covers, missing angles, low quality, rotation, and darkness
- AI suggestion approval in batches

Scale through automation and batching, not through separate interfaces.

## Vision 4: Business Intelligence Layer

Faust should move the user from manual operation toward strategic management.

Business Intelligence should cover:

- financial intelligence: revenue, profit, margin, fees, shipping, taxes, inventory value, COGS, cash flow, capital invested, ROI
- product performance: sell-through, days to sell, profit by category, brand, supplier, and marketplace
- marketplace performance: average sale, fees, time to sell, return rate, profit
- inventory intelligence: restock, liquidate, bundle, raise price, lower price, archive
- predictive analytics: expected sales, inventory depletion, seasonality, demand forecasting, cash-flow prediction

Analytics must consume existing domain and repository logic rather than duplicate calculations.

## Vision 5: Operational Automation

Every repetitive task should eventually disappear.

Examples:

```text
Product becomes Ready
-> generate drafts
-> queue review
```

```text
Inventory reaches zero
-> pause marketplace listings
```

```text
Product sold
-> reduce inventory
-> create sync tasks
-> notify affected marketplaces
```

```text
Marketplace rejects listing
-> generate review
-> suggest fix
```

```text
Price changed
-> generate sync review
-> apply when approved
```

Scheduled jobs should eventually handle nightly health checks, inventory reconciliation, marketplace verification, and performance summaries.

## Vision 6: Trust and Explainability

Automation without transparency creates anxiety. Faust must explain every significant action.

Every automated decision should answer:

- Why?
- Where did this value come from?
- Can I override it?
- Will it persist?

Every Product should maintain a complete activity timeline:

- creation
- edits
- marketplace publishes
- price changes
- inventory changes
- sync reviews
- failures
- retries
- sales

## Long-term product principles

### Product first

Products remain the source of truth. Marketplace listings are projections of Products. Never invert this relationship.

### Explain before automating

If Faust performs an action automatically, the user should be able to understand why.

### Automate only what is deterministic

High-confidence, repeatable actions can be automated. Subjective or uncertain decisions should be surfaced for review.

### Human approval where judgment matters

Faust should reduce manual effort without removing meaningful control.

### Scale without workflow changes

A seller with 10 Products, 100 Products, or 10,000 Products should use fundamentally the same workflows. The system should scale through automation and batching.

### Connector independence

Marketplace rules belong in Marketplace Intelligence. Connectors translate requests and responses. Products remain marketplace-agnostic.

### Modular growth

Major capabilities should remain modular, independently testable, and extensible:

- Product Knowledge Engine
- Marketplace Intelligence Engine
- Listings Composer
- Bulk Operations Engine
- Business Intelligence Layer
- Connector Framework
- Automation Engine

## Success definition

Faust is successful when the user's role changes from:

> I spend my day creating and maintaining listings.

to:

> I review intelligent suggestions, make a few high-value decisions, and let Faust handle the operational work.

That transformation, not simply supporting more marketplaces, is the long-term vision that should guide every major architectural decision.
