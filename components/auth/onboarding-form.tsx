"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FaustLogo } from "@/components/brand/faust-logo";

export function OnboardingForm() {
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [timezone, setTimezone] = useState("America/New_York");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/businesses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, currency, timezone }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not create workspace.");
      router.push("/");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create workspace.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background p-5">
      <form onSubmit={submit} className="faust-surface w-full max-w-xl p-7">
        <div className="flex flex-col items-center text-center">
          <FaustLogo className="h-36 w-64" />
          <p className="mt-1 text-xs font-medium uppercase tracking-[0.2em] text-[#c8d2e6]">Faust OS / onboarding</p>
          <h1 className="mt-3 text-2xl font-semibold">Create your business workspace</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">This creates the business boundary used to protect your catalog, orders, finance, and operations data.</p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            Business name
            <input required value={name} onChange={(event) => setName(event.target.value)} className="faust-field faust-focus mt-2 w-full px-3 py-2" placeholder="Frostbite Debuff" />
          </label>
          <label className="text-sm">
            Currency
            <select value={currency} onChange={(event) => setCurrency(event.target.value)} className="faust-field faust-focus mt-2 w-full px-3 py-2">
              <option>USD</option>
              <option>CAD</option>
              <option>GBP</option>
              <option>EUR</option>
            </select>
          </label>
          <label className="text-sm">
            Timezone
            <select value={timezone} onChange={(event) => setTimezone(event.target.value)} className="faust-field faust-focus mt-2 w-full px-3 py-2">
              <option>America/New_York</option>
              <option>America/Chicago</option>
              <option>America/Los_Angeles</option>
              <option>Europe/London</option>
            </select>
          </label>
        </div>

        <button disabled={busy} className="mt-6 rounded-full bg-[#56627f] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-950/30 transition hover:bg-[#66708d] disabled:opacity-50">
          {busy ? "Creating..." : "Create workspace"}
        </button>
        {error && <p className="mt-4 text-sm text-[#c8d2e6]">{error}</p>}
      </form>
    </main>
  );
}
