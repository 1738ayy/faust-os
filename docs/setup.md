# Setup

1. Copy `.env.example` to `.env.local`.
2. Install with `npm ci --legacy-peer-deps`.
3. Run `npm run dev` for local JSON development mode.
4. For production, create a Supabase project, apply migrations in order, set the Supabase URL/anon key, set `NEXT_PUBLIC_FAUST_AUTH_ENABLED=true`, and configure Auth redirect URLs for `/auth/callback`.

Never expose a service-role key to the browser or extension.
