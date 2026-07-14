"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { passwordUpdateSchema } from "@/lib/validation/requests";

export function UpdatePasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    const validated = passwordUpdateSchema.safeParse({ password, confirmPassword: confirm });
    if (!validated.success) {
      setError(validated.error.issues[0]?.message || "Check the password fields.");
      return;
    }
    setBusy(true);
    try {
      const { error: updateError } = await getSupabaseBrowserClient().auth.updateUser({ password: validated.data.password });
      if (updateError) throw updateError;
      router.push("/");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update password.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="grid min-h-screen place-items-center bg-background p-5"><form onSubmit={submit} className="w-full max-w-md border border-border bg-card p-7"><p className="text-xs uppercase tracking-[0.2em] text-emerald-400">Faust OS · recovery</p><h1 className="mt-2 text-2xl font-semibold">Choose a new password</h1><p className="mt-2 text-sm text-muted-foreground">This recovery session is supplied by the secure Supabase email link.</p><label className="mt-6 block text-sm">New password<input required type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full border border-border bg-background px-3 py-2" /></label><label className="mt-4 block text-sm">Confirm password<input required type="password" minLength={8} value={confirm} onChange={(event) => setConfirm(event.target.value)} className="mt-2 w-full border border-border bg-background px-3 py-2" /></label><button disabled={busy} className="mt-6 w-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-zinc-950 disabled:opacity-50">{busy ? "Updating…" : "Update password"}</button>{error && <p className="mt-4 text-sm text-red-300">{error}</p>}</form></main>;
}
