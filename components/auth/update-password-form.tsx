"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FaustLogo } from "@/components/brand/faust-logo";
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

  return (
    <main className="grid min-h-screen place-items-center bg-background p-5">
      <form onSubmit={submit} className="faust-surface w-full max-w-md p-7">
        <div className="flex flex-col items-center text-center">
          <FaustLogo className="h-32 w-56" />
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.2em] text-[#c8d2e6]">Faust OS recovery</p>
          <h1 className="mt-3 text-2xl font-semibold">Choose a new password</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">This recovery session is supplied by the secure Supabase email link.</p>
        </div>

        <label className="mt-6 block text-sm">
          New password
          <input required type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} className="faust-field faust-focus mt-2 w-full px-3 py-2" />
        </label>

        <label className="mt-4 block text-sm">
          Confirm password
          <input required type="password" minLength={8} value={confirm} onChange={(event) => setConfirm(event.target.value)} className="faust-field faust-focus mt-2 w-full px-3 py-2" />
        </label>

        <button disabled={busy} className="mt-6 w-full rounded-full bg-[#56627f] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-950/30 transition hover:bg-[#66708d] disabled:opacity-50">
          {busy ? "Updating..." : "Update password"}
        </button>

        {error && <p className="mt-4 text-sm text-[#c8d2e6]">{error}</p>}
      </form>
    </main>
  );
}
