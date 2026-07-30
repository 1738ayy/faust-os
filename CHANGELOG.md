# Changelog

## 1.0.0-rc.1

### Production readiness

- Added a daily operations and dogfooding readiness layer for release-candidate validation.
- Added normalized Supabase persistence for operations feedback and dogfooding sessions.
- Added a System Health & Daily Operations workspace under Settings for RC blockers, worker health, queue depth, failed tasks, provider readiness, and performance budgets.
- Added safe production error payloads with correlation IDs and secret redaction.

### Operational docs

- Added the Faust Daily Operations Runbook covering dogfooding, severity rules, performance budgets, incident recovery, and the release process.

### Migration notes

- Apply `036_daily_operations_readiness.sql` after `035_intelligence_observability_studio.sql`.
- The migration creates `operations_feedback` and `dogfooding_sessions` with RLS policies, tenant isolation, and indexes.

### Known external boundaries

- Live marketplace credentials, bank connections, and shipping provider credentials remain intentionally external until explicitly configured.
