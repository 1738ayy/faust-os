# Architecture

Read [FAUST Vision Lock](./faust-vision-lock.md) before planning major product or architecture changes. It defines the product identity, long-term pillars, and decision rules that keep Faust moving toward an Autonomous Commerce Operating System rather than a collection of disconnected tools.

Faust OS is a Next.js application with Supabase SSR authentication. In production, authenticated server access resolves the current business membership before reading tenant-scoped normalized records. Local JSON exists only when `NEXT_PUBLIC_FAUST_AUTH_ENABLED=false`.

The main flow is: route/API → validated request → domain workflow → normalized repository/RPC → RLS-protected Supabase tables. Browser extensions and third-party providers communicate only through adapter boundaries.
