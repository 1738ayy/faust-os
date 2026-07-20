"use client";

import { PackagePlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { useOpportunity } from "./opportunity-provider";

export function SaveButton() {
  const { opportunity } = useOpportunity();
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleSave() {
    if (!opportunity) return;
    setSaving(true);
    try {
      const response = await fetch("/api/opportunities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(opportunity) });
      const data = await response.json();
      if (!response.ok || data.success === false) throw new Error(data.message ?? "Product creation failed.");
      toast.success("Product created", { description: `${opportunity.product.name} is now in Products.` });
      router.push("/catalog");
      router.refresh();
    } catch (error) {
      toast.error("Product creation failed", { description: error instanceof Error ? error.message : "Unable to create this product." });
    } finally {
      setSaving(false);
    }
  }

  return <button onClick={handleSave} disabled={!opportunity || saving} className="flex items-center justify-center gap-2 rounded-full bg-sky-500 px-6 py-3 font-medium text-white shadow-lg shadow-sky-950/30 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"><PackagePlus className="h-5 w-5" />{saving ? "Creating product…" : "Create Product"}</button>;
}
