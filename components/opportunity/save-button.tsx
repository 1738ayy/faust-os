"use client";

import { Save } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useOpportunity } from "./opportunity-provider";

export function SaveButton() {
  const { opportunity } = useOpportunity();
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!opportunity) return;
    setSaving(true);
    try {
      const response = await fetch("/api/opportunities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(opportunity) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Save failed.");
      toast.success("Opportunity saved", { description: `${opportunity.product.name} is ready for your catalog.` });
    } catch (error) {
      toast.error("Save failed", { description: error instanceof Error ? error.message : "Unable to save this opportunity." });
    } finally {
      setSaving(false);
    }
  }

  return <button onClick={handleSave} disabled={!opportunity || saving} className="flex items-center justify-center gap-2 rounded-full bg-red-600 px-6 py-3 font-medium text-white shadow-lg shadow-red-950/30 transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"><Save className="h-5 w-5" />{saving ? "Saving…" : "Save opportunity"}</button>;
}
