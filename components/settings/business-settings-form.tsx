"use client";

import { useState } from "react";
import type { BusinessSettings } from "@/types/settings";

const field = "faust-field faust-focus mt-2 w-full px-3 py-2 font-normal";

export function BusinessSettingsForm({ settings }: { settings: BusinessSettings }) {
  const [value, setValue] = useState(settings);
  const [saving, setSaving] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
    setSaving(false);
  }

  return (
    <form onSubmit={save} className="mt-6 grid gap-5 sm:grid-cols-2">
      <label className="text-sm font-medium">Currency<select value={value.currency} onChange={(event) => setValue({ ...value, currency: event.target.value })} className={field}><option>USD</option><option>CAD</option><option>GBP</option><option>EUR</option></select></label>
      <label className="text-sm font-medium">Default marketplace<select value={value.defaultMarketplace} onChange={(event) => setValue({ ...value, defaultMarketplace: event.target.value })} className={field}><option value="depop">Depop</option><option value="ebay">eBay</option><option value="etsy">Etsy</option><option value="shopify">Shopify</option></select></label>
      <label className="text-sm font-medium">Warehouse name<input value={value.warehouseName} onChange={(event) => setValue({ ...value, warehouseName: event.target.value })} className={field} /></label>
      <label className="text-sm font-medium">Target margin (%)<input type="number" min="0" value={value.targetMargin} onChange={(event) => setValue({ ...value, targetMargin: Number(event.target.value) || 0 })} className={field} /></label>
      <button disabled={saving} className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-red-950/30 transition hover:bg-red-500 disabled:opacity-60 sm:col-span-2 sm:w-fit">{saving ? "Saving…" : "Save settings"}</button>
    </form>
  );
}
