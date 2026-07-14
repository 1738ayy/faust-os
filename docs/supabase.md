# Supabase setup

Faust OS has two persistence modes:

- Local development mode writes the temporary `.faust/` JSON adapter.
- Production mode uses Supabase Auth plus the normalized tenant-scoped tables in `supabase/migrations/`.

## Configure a project

1. Create a Supabase project and enable Email/Password authentication.
2. Apply `001_core_auth_and_tenancy.sql` and then `002_business_rpc_and_normalized_operations.sql` in that order. New deployments must use these versioned migrations; `supabase/schema.sql` is an older reference snapshot, not a migration source.
3. Copy `.env.example` to `.env.local` and supply the public project URL and anonymous key.
4. Set `NEXT_PUBLIC_FAUST_AUTH_ENABLED=true` only after the migrations and Auth redirect URLs are configured.
5. Add the following redirect URL in Supabase Auth: `https://your-domain/auth/callback` (and the local development equivalent).
6. Create an account and complete onboarding. Onboarding calls `create_business_with_defaults`, which creates the business, owner membership, settings, and initial transitional workspace record in one database transaction.

`SUPABASE_SERVICE_ROLE_KEY` is reserved for server-only jobs. Never expose it through a `NEXT_PUBLIC_` variable, browser code, or the Chrome extension.

## Production boundary

Production sessions use `@supabase/ssr`. The proxy refreshes the server session with `auth.getUser()`, server components and route handlers use the server client, and the password-recovery callback exchanges the code before the update-password screen calls `auth.updateUser()`.

The active-business cookie is only a preference. Every production repository read resolves the authenticated user’s memberships and uses the selected business only when that membership is valid; otherwise it chooses the first authorized business. A user with no authorized business is sent to onboarding.

The production operating repository reads and writes the normalized product, inventory, purchasing, parcel, listing, customer, order, transaction, task, notification, and activity tables. `business_workspace_states.data` is not used as production operating persistence. It remains only as a transitional migration/local-development compatibility record.

## Local fallback

Leave `NEXT_PUBLIC_FAUST_AUTH_ENABLED=false` (or unset). Faust OS will run in local development mode and write only to `.faust/`, which is excluded from source control and release archives. This fallback is intentionally not a production tenancy or authorization boundary.

## Live integration harness

Create `.env.integration.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_TEST_OWNER_EMAIL`, and `SUPABASE_TEST_OWNER_PASSWORD`. Apply migrations first, create the test owner through normal onboarding, then run `npm run test:supabase`. Add admin/viewer test accounts and memberships to expand this harness into live cross-business/RLS role checks.
