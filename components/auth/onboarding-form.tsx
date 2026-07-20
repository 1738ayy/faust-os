"use client";
/* eslint-disable @next/next/no-img-element -- the brand mark is a static SVG and should not depend on image optimization. */

import { useState } from "react";
import { useRouter } from "next/navigation";

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
          <img
            alt="Faust OS logo"
            src="/brand/faust-pony.svg"
            className="h-28 w-28 rounded-[2rem] border border-sky-400/20 object-contain p-1 shadow-2xl shadow-sky-950/40"
          />
          <p className="mt-4 text-xs font-medium uppercase tracking-[0.2em] text-sky-200">Faust OS / onboarding</p>
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

        <button disabled={busy} className="mt-6 rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-950/30 transition hover:bg-sky-400 disabled:opacity-50">
          {busy ? "Creating..." : "Create workspace"}
        </button>
        {error && <p className="mt-4 text-sm text-sky-200">{error}</p>}
      </form>
    </main>
  );
}
