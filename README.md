# Faust OS

Faust OS is a dark-first operating system for a resale business. It connects sourcing, products, stock, purchasing, inbound parcels, listings, orders, fulfillment, finance, tasks, and evidence-backed operating insights.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Mission Control is the homepage. A fresh workspace has no invented data: use **Load development demo** to inspect a clearly labelled, internally connected sample workflow, or start from **Sourcing** with a real product.

## What works locally

- Mission Control calculations for revenue, profit, cash, stock, fulfillment, inbound units, attention items, and activity.
- Product/variant/stock relationship model, with available quantity and an immutable movement ledger.
- Order shipment transition: shipping deducts physical inventory and writes an audit event; cancelling releases a reservation.
- Purchase-order parcel receiving: receiving updates parcel state, purchase-order state, balances, and movement history.
- Listing records with a truthful **manual publishing required** state.
- Existing Superbuy extension import and Opportunity Analyzer. Saving an opportunity also creates a connected supplier, product, variant, stock balance, and listing draft.
- Local JSON development adapter at `.faust/operating-system.json`. This is not production persistence.

## Chrome extension

1. Start Faust with `npm run dev`.
2. In Chrome, visit `chrome://extensions`, enable Developer mode, and choose **Load unpacked**.
3. Select the project `extension` folder.
4. Complete any Superbuy human verification on a real product page, then use **Import Current Product**.
5. Open **Sourcing → Opportunity Analyzer** and select **Import Superbuy**.

The extension can import values exposed on the open product page. Shipping amounts unavailable in the page are intentionally left editable rather than guessed.

## Supabase handoff

1. Copy `.env.example` to `.env.local` and add the project URL and anonymous key.
2. Run the versioned SQL files in `supabase/migrations/` in numeric order.
3. Configure Supabase Email/Password Auth, then set `NEXT_PUBLIC_FAUST_AUTH_ENABLED=true`.
4. Create an account and complete onboarding to create the protected business workspace.

No marketplace is marked connected or publishable without approved API access and credentials. Shipping label purchase, marketplace order sync, automatic cross-listing, and 17TRACK polling are intentionally integration boundaries; the local workflows preserve the records and manual fallback required to connect them later.

## Useful checks

```bash
npm run lint
npm run build
```
