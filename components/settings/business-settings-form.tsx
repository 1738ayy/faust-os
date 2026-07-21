"use client";

import { useState } from "react";
import type { BusinessSettings } from "@/types/settings";

const field = "faust-field faust-focus mt-2 w-full px-3 py-2 font-normal";

export function BusinessSettingsForm({ settings }: { settings: BusinessSettings }) {
  const [value, setValue] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Settings could not be saved.");
      setValue(data.settings);
      setMessage("Settings saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="mt-6 grid gap-5 sm:grid-cols-2">
      <label className="text-sm font-medium">
        Currency
        <select value={value.currency} onChange={(event) => setValue({ ...value, currency: event.target.value.toUpperCase() })} className={field}>
          <option>USD</option><option>CAD</option><option>GBP</option><option>EUR</option>
        </select>
      </label>
      <label className="text-sm font-medium">
        Default marketplace
        <select value={value.defaultMarketplace} onChange={(event) => setValue({ ...value, defaultMarketplace: event.target.value })} className={field}>
          <option value="depop">Depop</option><option value="ebay">eBay</option><option value="etsy">Etsy</option><option value="mercari">Mercari</option><option value="poshmark">Poshmark</option>
        </select>
      </label>
      <label className="text-sm font-medium">Warehouse name<input value={value.warehouseName} onChange={(event) => setValue({ ...value, warehouseName: event.target.value })} className={field} placeholder="Home warehouse" /></label>
      <label className="text-sm font-medium">Target margin (%)<input type="number" min="0" max="100" value={value.targetMargin} onChange={(event) => setValue({ ...value, targetMargin: Number(event.target.value) || 0 })} className={field} /></label>
      <fieldset className="rounded-2xl border border-slate-700/45 bg-black/25 p-4 sm:col-span-2">
        <legend className="px-2 text-sm font-semibold">Marketplace Fees · Depop</legend>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-3 text-sm font-medium"><input type="checkbox" checked={value.depopBoostEnabledByDefault ?? true} onChange={(event) => setValue({ ...value, depopBoostEnabledByDefault: event.target.checked })} className="h-4 w-4 accent-[#66708d]" />Use Depop Boost by default</label>
          <label className="text-sm font-medium">Default Boost rate (%)<input type="number" min="0" max="100" step="0.1" value={value.depopBoostRate ?? 12} onChange={(event) => setValue({ ...value, depopBoostRate: Number(event.target.value) || 0 })} className={field} /></label>
        </div>
      </fieldset>
      <button disabled={saving} className="rounded-full bg-[#56627f] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-950/30 transition hover:bg-[#66708d] disabled:opacity-60 sm:col-span-2 sm:w-fit">{saving ? "Saving..." : "Save settings"}</button>
      {message && <p className="text-sm text-[#edf3ff] sm:col-span-2">{message}</p>}
    </form>
  );
}
