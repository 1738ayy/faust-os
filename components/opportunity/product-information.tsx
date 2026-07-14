"use client";

import { useOpportunity } from "./opportunity-provider";

export function ProductInformation() {
  const { opportunity, updateProduct } = useOpportunity();
  if (!opportunity) return null;
  const product = opportunity.product;

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-xl font-semibold">Product</h2>
      <p className="mt-1 text-sm text-muted-foreground">Imported Superbuy facts are editable when you need to correct them.</p>
      <div className="mt-7 space-y-5">
        {([
          ["name", "Product name"],
          ["category", "Category"],
          ["material", "Material"],
          ["dimensions", "Dimensions"],
          ["weight", "Weight"],
        ] as const).map(([field, label]) => (
          <label key={field} className="block text-sm font-medium">
            {label}
            <input value={product[field] ?? ""} onChange={(event) => updateProduct(field, event.target.value)} className="mt-2 w-full rounded-xl border border-border bg-background p-3 font-normal" />
          </label>
        ))}
        <label className="block text-sm font-medium">
          Description
          <textarea rows={4} value={product.description ?? ""} onChange={(event) => updateProduct("description", event.target.value)} className="mt-2 w-full resize-none rounded-xl border border-border bg-background p-3 font-normal" />
        </label>
      </div>
    </section>
  );
}
