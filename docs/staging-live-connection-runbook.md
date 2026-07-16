# Faust Staging Deployment & Live Connection Runbook

This phase proves Faust works outside local/demo mode. Do not connect all marketplaces yet. Connect one AI provider and one shipping sandbox provider only.

## 0. Local preflight

Run from the repository root:

```bash
npm ci --legacy-peer-deps
npm run production:migrations
npm run lint
npm run typecheck
npm test
npm run build
```

Expected result: every command exits successfully.

## 1. Create staging Supabase

Manual intervention:

- Service: Supabase
- Page: Supabase Dashboard → New project
- Fields:
  - Project name: `faust-staging`
  - Region: choose closest to you
  - Database password: generate and save in your password manager
- Expected afterward: project URL looks like `https://<project-ref>.supabase.co`

Then go to:

- Supabase → Authentication → Providers
- Enable: Email
- Confirm email behavior: for staging, use the simplest email/password path first.

## 2. Apply migrations

Preferred CLI flow:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

If using SQL editor instead:

1. Open Supabase → SQL Editor.
2. Apply every file in `supabase/migrations/` in ascending numeric order.
3. Start at `001_core_auth_and_tenancy.sql`.
4. End at `022_browser_extension_phase2.sql`.

Local verification:

```bash
npm run production:migrations
```

Expected afterward:

- no duplicate migration numbers
- no migration gaps
- latest migration is `022_browser_extension_phase2.sql`

## 3. Create storage buckets

Manual intervention:

- Service: Supabase
- Page: Storage → New bucket
- Create these buckets:

```text
staging-product-images
staging-receipts
staging-shipping-labels
staging-packing-photos
staging-extension-screenshots
staging-extension-dom-snapshots
staging-extension-logs
staging-publish-evidence
```

Suggested access:

- `staging-product-images`: public or private, your choice for staging
- all others: private

Expected afterward: the staging live-check can upload/download/delete a JSON probe in `staging-extension-logs`.

## 4. Create staging test owner

Manual intervention:

- Service: Supabase
- Page: Authentication → Users → Add user
- Fields:
  - Email: `owner+staging@your-domain.com`
  - Password: temporary strong password
  - Auto confirm user: yes

Expected afterward: you can sign into the staging app.

## 5. Deployment environment values

Copy `.env.staging.example` to a private local file:

```bash
copy .env.staging.example .env.staging.local
```

Use these formats:

```bash
FAUST_ENV=staging
STAGING_APP_URL=https://<your-staging-app-domain>
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<Supabase anon public key>
NEXT_PUBLIC_FAUST_AUTH_ENABLED=true
SUPABASE_SERVICE_ROLE_KEY=<Supabase service role key>

SUPABASE_STORAGE_BUCKET_PRODUCT_IMAGES=staging-product-images
SUPABASE_STORAGE_BUCKET_RECEIPTS=staging-receipts
SUPABASE_STORAGE_BUCKET_LABELS=staging-shipping-labels
SUPABASE_STORAGE_BUCKET_PACKING_PHOTOS=staging-packing-photos
SUPABASE_STORAGE_BUCKET_EXTENSION_SCREENSHOTS=staging-extension-screenshots
SUPABASE_STORAGE_BUCKET_EXTENSION_DOM_SNAPSHOTS=staging-extension-dom-snapshots
SUPABASE_STORAGE_BUCKET_EXTENSION_LOGS=staging-extension-logs
SUPABASE_STORAGE_BUCKET_PUBLISH_EVIDENCE=staging-publish-evidence

AUTOMATION_WORKER_URL=https://<your-staging-app-domain>/api/automations/actions
AUTOMATION_WORKER_ID=faust-worker-staging-1
AUTOMATION_WORKER_CONCURRENCY=4
AUTOMATION_WORKER_POLL_MS=5000
AUTOMATION_WORKER_LEASE_MS=30000
BROWSER_EXTENSION_WORKER_ENABLED=true

FAUST_ALLOWED_EXTENSION_ORIGINS=chrome-extension://*,https://<your-staging-app-domain>
FAUST_EXTENSION_TOKEN_TTL_SECONDS=3600

AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=
GEMINI_API_KEY=

SHIPPING_PROVIDER=easypost
EASYPOST_API_KEY=EZTK...
SHIPPO_API_KEY=

SUPABASE_TEST_OWNER_EMAIL=owner+staging@your-domain.com
SUPABASE_TEST_OWNER_PASSWORD=<temporary-staging-password>
```

Security rule: `SUPABASE_SERVICE_ROLE_KEY` must never be named `NEXT_PUBLIC_*`, never placed in the extension, and never shown in browser devtools.

## 6. Deploy the staging app

Use your hosting provider. For Vercel-style deployment:

```bash
npm run build
```

Manual intervention:

- Service: hosting provider
- Page: Project → Environment Variables
- Add every value from `.env.staging.local`
- Environment: Preview/Staging
- Expected afterward: deployed URL returns the Faust app.

Verify:

```bash
curl https://<your-staging-app-domain>/api/health
```

Expected:

- HTTP 200
- migrations ready
- storage ready
- provider section warns only for deliberately unconnected credentials

## 7. Bootstrap business/workspace

Manual intervention:

- Page: `https://<your-staging-app-domain>/sign-in`
- Sign in with the staging test owner
- Complete onboarding
- Business name: `Faust Staging`
- Currency: `USD`
- Timezone: `America/New_York`

Expected afterward:

- `create_business_with_defaults` creates business, owner membership, settings, and workspace state
- `faust-active-business` cookie selects the business
- app pages do not fall back to local/demo mode

## 8. Deploy staging worker

Run as a separate process:

```bash
FAUST_ENV=staging AUTOMATION_WORKER_URL=https://<your-staging-app-domain>/api/automations/actions AUTOMATION_WORKER_ID=faust-worker-staging-1 npm run worker:automations
```

Expected logs:

```json
{"level":"info","message":"Automation worker starting",...}
{"level":"info","message":"Automation worker tick complete",...}
```

Expected in Faust:

- Automations → Worker health shows `faust-worker-staging-1`
- queue depth visible
- dead letters visible

Stop the worker with Ctrl+C. Expected:

```json
{"level":"info","message":"Automation worker stopped","gracefulShutdown":true}
```

## 9. Run staging live-check

After the app, Supabase user, buckets, and env file are ready:

```bash
npm run staging:live-check
```

Expected:

- `/api/health` passes
- Supabase auth sign-in succeeds
- RLS membership read succeeds
- storage upload/download/delete probe succeeds
- selected AI provider credential is present
- selected shipping sandbox credential is present

## 10. Connect one AI provider

Start with OpenAI unless you prefer another provider.

Manual intervention:

- Service: OpenAI
- Page: API Keys
- Field/value: create one staging key and paste it as `OPENAI_API_KEY`
- Set `AI_PROVIDER=openai`

Staging UI verification:

1. Open AI Center.
2. Ask: `What should I reorder today?`
3. Confirm:
   - answer cites Faust source records
   - tool calls are logged
   - latency/cost observability appears
   - risky actions route to approval
   - deterministic fallback still works if the key is removed

Do not let AI directly execute purchase orders, refunds, tax moves, or destructive inventory changes.

## 11. Connect one shipping sandbox provider

Start with EasyPost sandbox.

Manual intervention:

- Service: EasyPost
- Page: API Keys
- Field/value: sandbox/test API key, format similar to `EZTK...`
- Set:

```bash
SHIPPING_PROVIDER=easypost
EASYPOST_API_KEY=EZTK...
```

Staging UI verification:

1. Open Shipping.
2. Select a staging shipment.
3. Validate address.
4. Load rates.
5. Select best rate.
6. Generate sandbox label.
7. Open label PDF.
8. Void label.
9. Refresh tracking.
10. Confirm failures show structured error messages.

## 12. Configure extension against staging

Manual intervention:

- Browser: Chrome/Edge
- Page: `chrome://extensions`
- Enable Developer Mode
- Load unpacked: `extension/`
- Open extension options
- Fields:
  - Faust API URL: `https://<your-staging-app-domain>`
  - Environment: `staging`
  - Device name: `Faust Chrome Extension - Staging`

Expected afterward:

- extension device registers
- short-lived token issued
- Settings → Connected extension devices shows the device

## 13. End-to-end staging scenario

Run exactly one controlled scenario:

1. Open a Superbuy/1688 product page.
2. Use the extension to scan.
3. Confirm profitability analysis in Faust.
4. Approve import.
5. Verify supplier, SKU, purchase draft, inventory lot, and landed cost estimate.
6. Verify five listing drafts.
7. Use one test channel only for guided publish dry-run.
8. Confirm external listing ID/URL manually if using a test listing page.
9. Import one test order.
10. Reserve inventory.
11. Fulfill order.
12. Generate sandbox shipping label.
13. Dispatch.
14. Verify Finance ledger.
15. Verify Analytics refresh.
16. Trigger/observe Automation event.
17. Generate AI daily brief.

Stop and record any point that requires a real account click or credential.

## 14. Final staging gate

Staging is accepted only when:

- `/api/health` is green enough for staging
- migrations complete
- RLS owner membership read passes
- worker heartbeat active
- storage upload/download works
- extension connected
- one AI provider works
- one shipping sandbox provider works
- one complete staging workflow succeeds
- Linux CI remains green

Do not begin all five live marketplace integrations yet.
