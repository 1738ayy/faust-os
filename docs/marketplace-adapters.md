# Marketplace Adapter Platform

Marketplace adapters are the execution layer between Faust and external marketplaces. They do not contain Product Knowledge, pricing logic, category intelligence, pipeline rules, or Action Center workflow logic.

Faust’s core flow is:

```text
Product Knowledge
→ Marketplace Draft
→ Marketplace Adapter SDK
→ Marketplace API
→ normalized listing snapshot + diagnostics
```

## Adapter contract

Every adapter implements the shared `MarketplaceAdapter` contract from `lib/marketplace-adapter-sdk.ts`:

- `connect`
- `disconnect`
- `health`
- `publish`
- `update`
- `endListing`
- `relist`
- `sync`
- `uploadImages`
- `validateDraft`
- `translateDraft`
- `diagnostics`

The workflow layer calls adapters through `ConnectorFactory.forMarketplace(...)`; it should not instantiate marketplace-specific classes directly.

## Shared runtime responsibilities

The SDK owns reusable connector behavior:

- adapter registry and factory lookup
- capability declarations
- normalized connector errors
- timeout/retry metadata
- request duration telemetry
- diagnostic persistence helpers
- listing snapshot persistence helpers
- fixture adapter conformance behavior

Adapters only translate Faust drafts into marketplace payloads and call marketplace APIs.

## Adding a marketplace

To add a marketplace:

1. Create an adapter class implementing `MarketplaceAdapter`.
2. Keep marketplace-specific translation in `translateDraft`.
3. Keep API calls inside the adapter only.
4. Register the adapter in `lib/marketplace-adapter-platform.ts`.
5. Add conformance tests using the shared adapter test shape.
6. Add production credentials through environment variables or server-only secret storage.
7. Verify local fixture mode and production/Supabase persistence parity.

No Product Knowledge, Product Pipeline, Publishing Queue, or Action Center architecture should need to change.

## Current adapters

- Depop: first production connector and reference implementation.
- eBay, Etsy, Mercari, Poshmark: fixture adapters that prove additional marketplaces can register without workflow changes.

API publication still requires marketplace credentials and marketplace partner approval where applicable. Manual or extension-assisted flows remain the truthful fallback until a marketplace has live credential access.
