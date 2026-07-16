# Faust OS Production Connection Runbook

This runbook moves Faust from local/demo mode into staging or production without changing business behavior.

## 1. Environments

Use three separate configurations:

- `local`: JSON fallback, optional Supabase, no live providers.
- `staging`: production-like Supabase project, test data, sandbox/mock providers.
- `production`: production Supabase project, real users, no marketplace/carrier/bank credentials until explicit provider connection phases.

Required app values:

- `FAUST_ENV`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_FAUST_AUTH_ENABLED`
- `SUPABASE_SERVICE_ROLE_KEY` server-side only
- storage bucket names from `.env.example`
- worker values from `.env.example`
- extension origin/token settings from `.env.example`

Never expose service-role keys through `NEXT_PUBLIC_*`, browser bundles, or the extension.

## 2. Supabase setup sequence

1. Create a Supabase project.
2. Enable Email/Password Auth.
3. Apply `supabase/migrations/*.sql` in ascending numeric order.
4. Run `npm run production:migrations` locally to verify ordering expectations.
5. Create the first admin user through Supabase Auth.
6. Sign into Faust and complete onboarding, which calls `create_business_with_defaults`.
7. Verify `/api/health`.

Migration rollback strategy is backup-based: restore the last verified database backup and redeploy the last known-good application artifact. Migrations are treated as forward-only.

## 3. Storage

Create buckets for:

- product images
- receipts
- shipping labels
- packing photos
- extension screenshots
- extension DOM snapshots
- extension logs
- publish evidence

Private buckets must use signed URLs or server-mediated access. Product image buckets may be public if desired.

## 4. Worker deployment

Deploy `npm run worker:automations` as a separate worker process.

Worker responsibilities:

- automation schedule/outbox/retry consumption
- dead-letter replay handling
- heartbeat writes
- browser/extension job queue readiness
- structured JSON logs
- graceful shutdown on `SIGINT` / `SIGTERM`

Production values:

- `AUTOMATION_WORKER_URL=https://<app>/api/automations/actions`
- `AUTOMATION_WORKER_ID=<stable worker name>`
- `AUTOMATION_WORKER_CONCURRENCY=4`
- `AUTOMATION_WORKER_POLL_MS=5000`
- `AUTOMATION_WORKER_LEASE_MS=30000`

## 5. Extension configuration

The extension connects to the deployed app URL, registers a device, receives a short-lived token, and sends a nonce per request. Revoked devices cannot continue sending authenticated extension actions.

Do not store marketplace passwords in Faust. Use active browser sessions only.

## 6. Health checks

Use:

```bash
curl https://<app>/api/health
```

The health response covers:

- environment validation
- database/Supabase configuration
- migration inventory
- storage descriptors
- worker readiness
- queue/dead-letter depth
- extension connectivity
- provider connectivity placeholders

Provider connectivity is expected to be `warning` until marketplace, carrier, and banking credentials are intentionally connected.

## 7. Backups and restore

Before production enablement:

1. Enable Supabase scheduled backups.
2. Record backup restore procedure.
3. Test restore in staging.
4. Keep the application build artifact tied to the migration set that produced it.

## 8. Secret rotation

Rotate in this order:

1. Create new key/secret in provider.
2. Add new secret to deployment environment.
3. Redeploy app/worker.
4. Verify `/api/health`.
5. Revoke old secret.
6. Record the rotation in operations notes.

## 9. Incident recovery

1. Put workers in drain mode by stopping worker processes.
2. Disable risky provider jobs.
3. Check `/api/health`, Supabase logs, worker logs, and dead letters.
4. Restore backup if data corruption is confirmed.
5. Re-enable workers after queues and health checks are clean.

## 10. Staging acceptance

Staging is ready when:

- migrations apply cleanly
- auth sign-in/onboarding works
- `/api/health` is not blocked
- worker starts and writes heartbeat
- storage descriptors are configured
- extension device registration works
- no service-role key is exposed publicly
- live marketplace/carrier/bank credentials remain disconnected
