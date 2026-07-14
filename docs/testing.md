# Testing

Run `npm run validate` for the full local validation chain. `npm run test:e2e` is a real Playwright Chromium suite; run `npx playwright install chromium` once after install when the browser runtime is absent. `npm run test:journey` retains the fast TypeScript source-to-sale contract journey. Tests compile with Node's type declarations through `@types/node`; use Node 20 or newer. Live Supabase RLS/session tests require a dedicated configured project and test users.
