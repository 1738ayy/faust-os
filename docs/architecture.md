# Architecture

Faust OS is a Next.js application with Supabase SSR authentication. In production, authenticated server access resolves the current business membership before reading tenant-scoped normalized records. Local JSON exists only when `NEXT_PUBLIC_FAUST_AUTH_ENABLED=false`.

The main flow is: route/API → validated request → domain workflow → normalized repository/RPC → RLS-protected Supabase tables. Browser extensions and third-party providers communicate only through adapter boundaries.
