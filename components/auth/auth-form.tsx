"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { getPublicEnv } from "@/lib/env";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { authCredentialsSchema, passwordRecoverySchema } from "@/lib/validation/requests";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" | "forgot-password" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const title = mode === "sign-in" ? "Sign in to Faust OS" : mode === "sign-up" ? "Create your workspace" : "Reset your password";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const env = getPublicEnv();
      if (!env.isSupabaseConfigured || !env.authEnabled) throw new Error("Authentication is not enabled yet. Add Supabase credentials and set NEXT_PUBLIC_FAUST_AUTH_ENABLED=true.");
      const auth = getSupabaseBrowserClient().auth;
      if (mode === "forgot-password") {
        const validated = passwordRecoverySchema.safeParse({ email });
        if (!validated.success) throw new Error(validated.error.issues[0]?.message || "Enter a valid email address.");
        const { error } = await auth.resetPasswordForEmail(validated.data.email, { redirectTo: `${window.location.origin}/auth/callback?next=/update-password` });
        if (error) throw error;
        setMessage("Password reset email sent. Check your inbox.");
        return;
      }
      const validated = authCredentialsSchema.safeParse({ email, password });
      if (!validated.success) throw new Error(validated.error.issues[0]?.message || "Check the form fields.");
      if (mode === "sign-up") {
        const { data, error } = await auth.signUp({ email: validated.data.email, password: validated.data.password, options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding` } });
        if (error) throw error;
        if (data.session) router.push("/onboarding"); else setMessage("Check your email to confirm your account, then sign in.");
        return;
      }
      const { error } = await auth.signInWithPassword({ email: validated.data.email, password: validated.data.password });
      if (error) throw error;
      router.push("/");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not continue.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="grid min-h-screen place-items-center bg-background p-5"><form onSubmit={submit} className="w-full max-w-md border border-border bg-card p-7"><p className="text-xs uppercase tracking-[0.2em] text-emerald-400">Faust OS</p><h1 className="mt-2 text-2xl font-semibold">{title}</h1><p className="mt-2 text-sm text-muted-foreground">Secure, refreshable Supabase session access.</p><label className="mt-6 block text-sm">Email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full border border-border bg-background px-3 py-2" /></label>{mode !== "forgot-password" && <label className="mt-4 block text-sm">Password<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full border border-border bg-background px-3 py-2" /></label>}<button disabled={busy} className="mt-6 w-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50">{busy ? "Working…" : mode === "sign-in" ? "Sign in" : mode === "sign-up" ? "Create account" : "Send reset email"}</button>{message && <p className="mt-4 text-sm text-muted-foreground">{message}</p>}<div className="mt-5 flex justify-between text-xs text-emerald-400">{mode !== "sign-in" ? <Link href="/sign-in">Sign in</Link> : <Link href="/sign-up">Create account</Link>}<Link href="/forgot-password">Reset password</Link></div></form></main>;
}
