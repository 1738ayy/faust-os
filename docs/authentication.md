# Authentication

`@supabase/ssr` supplies browser and server clients. The proxy refreshes sessions, protected routes redirect unauthorized users, and `/auth/callback` exchanges confirmation/recovery codes. Password reset emails return to `/update-password`, which calls `auth.updateUser()`.

Configure Supabase Auth Site URL and redirect URLs for every deployment plus local development. Expired sessions must be exercised against a configured Supabase project before deployment.
