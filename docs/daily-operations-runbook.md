# Faust Daily Operations Runbook

Faust V1.0 release candidates are validated through daily dogfooding, not feature count. A release is healthy only when the import → review → draft → publish → monitor → sell → archive loop is reliable for real inventory work.

## Daily dogfooding loop

1. Import real sourcing candidates from the browser extension.
2. Review the import queue and Product Pipeline.
3. Correct only uncertain Product Knowledge fields.
4. Generate drafts and publish only through explicit approval gates.
5. Watch Action Center, Listings, Automations, and System Health for failures.
6. Log every repeated annoyance or broken expectation in Settings → System Health.

## Severity rules

- Critical: blocks selling, risks data loss, creates duplicate products/listings, exposes secrets, or can cause overselling.
- High: blocks a core workflow, requires external manual cleanup, or repeatedly costs meaningful time.
- Medium: slows daily work but has a safe workaround.
- Low: polish, copy, minor confusion, or one-off friction.

Critical and high feedback records are release-candidate blockers until resolved or explicitly deferred with a reason.

## Production metrics to watch

- Import success rate.
- Time from import to publish.
- Publish success rate.
- Automation success rate.
- Queue depth.
- Failed tasks and dead letters.
- Connector errors.
- Average review time per product.
- Average user corrections per product.

## Performance budgets

- Import → queue visible: under 2 seconds.
- Review session render: under 500 ms.
- Draft generation: under 1 second for normal single-product flows.
- Queue refresh: under 250 ms.
- Action Center render: under 500 ms.

## Release process

1. Update the semantic version in `package.json`.
2. Add a `CHANGELOG.md` entry with user-facing changes, operational changes, migrations, and known limitations.
3. Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run test:load`, and `npm run build`.
4. Apply Supabase migrations in numeric order.
5. Verify `/api/health` and Settings → System Health.
6. Confirm no critical or high dogfooding feedback remains open.
7. Push and verify Linux CI.

## Incident recovery

Use the correlation ID from an API response or System Health error signal to find matching Vercel/Supabase logs. Never paste secrets into chat or issue reports. Attach diagnostics bundles, product IDs, workflow name, expected behavior, actual behavior, and whether a workaround exists.
