# Faust OS usability and product-experience audit

## Current sample-data sources

- `services/operating-system/repository.ts` contains the main `developmentDemo()` workspace and the empty workspace factory.
- `.faust/operating-system.json` is the local JSON development workspace. It can contain either empty, development demo, or user-entered local records.
- `services/business/repository.ts` stores local businesses in `.faust/businesses.json`.
- Test fixtures live under `tests/**` and Playwright resets through `/api/operating-system` with `mode: "development_demo"`.
- Mock/provider-ready adapters are in `services/adapters/**`, especially shipping and marketplace adapters.
- Extension tests and parser fixtures live in `tests/browser-extension*.test.ts`.

Risk: demo data is clearly labelled in some places, but the UI does not yet make the difference between demo, staging, and real data obvious everywhere. Some module summary functions still seed support data such as marketplace accounts/templates or supplier operations when opened.

## Current navigation problems

- Primary navigation mixes daily business work with internal modules, settings, automation, marketplace pages, and legacy routes.
- `Sourcing` and `Opportunity Analyzer` overlap in user meaning.
- `AI Center` should be labelled as `Ask Faust` for a nontechnical owner.
- Marketplace-by-marketplace pages appear as a separate nav block even though they are more of a Listings detail view.
- `Tasks`, `Suppliers`, `Customers`, `Automations`, Search, and technical settings should be reachable without competing with the main operating flow.

## Current Ask Faust limitations

- The AI Center has grounded deterministic behavior and provider adapters, but the UI still feels like an internal tool center.
- Suggested prompts need to be based more directly on the active workspace state.
- Answers should present action, reasoning, supporting metrics, linked records, confidence, and next action more visibly.
- Missing-data states need to say exactly what records are missing.

## Current Opportunity Analyzer limitations

- Opportunity import and scoring are technically connected, but the flow still feels split between Sourcing, Opportunity Analyzer, extension scan, and Listings.
- Known values, assumptions, estimates, and missing values are not visually separated enough.
- Superbuy wrapper pages can produce noisy seller/store metadata.
- Raw payload/debug information should move behind Advanced.

## Current extension architecture

- Manifest V3 extension has background, content scripts, popup, side panel, options, marketplace adapters, and Superbuy extraction.
- Extension can scan Superbuy/1688, analyze profitability through Faust, import product/SKU/purchase draft data, create five marketplace drafts, and perform guarded guided-fill workflows.
- Marketplace fill remains intentionally safe: no publish button is clicked. Complex marketplace controls can require manual completion.
- Recent live eBay testing proved the bridge works but highlighted selector/form-control reliability issues.

## Current typography/design system limitations

- The app uses good Tailwind tokens but still feels dense and technical.
- Many components use hard borders, small text, and diagnostic labels.
- Radius is set to `0`, making cards/buttons feel harsher than a polished operating system.
- Mojibake text appears in a few places from earlier copy/paste encoding.
- Shared page/card/button patterns need to become more consistent.

## Slow or unclear user actions

- Extension scan/import and guided fill need clearer progress states.
- Long-running API actions often show only generic button text.
- Operations like loading demo data, importing products, generating drafts, and worker-driven processes need step-by-step feedback.
- Some pages still expose queue/worker/provider details in places that should be user-focused.

## Proposed files and modules to change in Phase 1

- `docs/usability-product-audit.md`: record this audit and phase plan.
- `lib/navigation.ts`: simplify primary labels and move internal/legacy routes out of primary flow.
- `components/navigation/nav-main.tsx`: regroup navigation into Owner-focused primary sections and System.
- `components/navigation/nav-marketplaces.tsx`: reduce marketplace clutter and route users through Listings.
- `components/navigation/top-navigation.tsx`: improve environment labeling and remove technical wording/mojibake.
- `components/navigation/app-layout.tsx`: improve spacing and page surface.
- `app/globals.css`: establish softer radius, cleaner body rendering, and reusable polish.
- `components/operations/metric-card.tsx`: upgrade KPI card style.
- `components/operations/operation-button.tsx`: clearer feedback and support safe clear-demo copy.
- `components/operations/mission-control.tsx`: redesign as an operational command surface and move diagnostics out.

## Phase 1 scope

Implement:

- Safe, clearly labelled demo clearing and demo loading.
- More explicit empty states for real importing.
- Simplified primary navigation.
- Typography and surface polish through shared tokens/components.
- Mission Control focused on orders, reorders, listings, shipments, cash, opportunities, and recent performance.

Do not implement in Phase 1:

- A full Ask Faust redesign.
- Complete opportunity workflow redesign.
- New schema migrations.
- Marketplace expansion or external integration validation.
