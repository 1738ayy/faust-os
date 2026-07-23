# Faust performance baseline

Phase E.15 starts with instrumentation before broad optimization. The goal is to make staging feel close to local without guessing.

## Budgets

| Workflow | Perceived budget |
| --- | ---: |
| Initial page interaction | < 800 ms |
| Product workspace navigation | < 250 ms perceived |
| Product edits | immediate optimistic response |
| Image upload preview | immediate local preview |
| Extension import acknowledgement | < 150 ms perceived |
| Product publish | optimistic immediately; persistence can continue in the background |

## Instrumentation added

- Development-only `PerformanceOverlay` in the app shell.
- Client metrics split into TTFB, DOM/load, hydration window, API resource time, image resource time, script resource time, and request count.
- Product mutation API now emits `Server-Timing` for `parse_json`, `validate`, and `repository`.
- Product detail pages now build only the requested product experience instead of building the entire catalog and searching it.
- Catalog product cards use browser-native `content-visibility: auto` so large catalogs do less offscreen rendering work.

## How to capture a staging baseline

1. Open staging in Chrome.
2. Open DevTools → Network.
3. Enable “Preserve log”.
4. Visit:
   - `/`
   - `/catalog`
   - one `/catalog/{variantId}` workspace
   - `/opportunity-analyzer`
5. For product edits, inspect `/api/products/actions` and record the `Server-Timing` header.
6. Record before/after timing in this file.

## Current local validation

Local validation confirms the instrumentation and targeted optimization do not regress correctness:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

## Known remaining measurement work

Staging-specific latency still needs live measurement because it depends on Vercel region, Supabase region, storage region, cold starts, and network distance. Do not claim those bottlenecks are solved until the staging timings above are captured.

