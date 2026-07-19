"use client";

import { useOpportunity } from "./opportunity-provider";

export function ProductInformation() {
  const { opportunity, updateProduct, updateSupplier, updateSourceFact } = useOpportunity();
  if (!opportunity) return null;
  const product = opportunity.product;
  const numberValue = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  return (
    <section className="faust-surface p-6">
      <h2 className="text-xl font-semibold">Clean up scan details</h2>
      <p className="mt-1 text-sm text-muted-foreground">Fix the scanner output here before you create the product and inventory record.</p>
      <div className="mt-7 grid gap-5 lg:grid-cols-2">
        <label className="block text-sm font-medium lg:col-span-2">
          Product name
          <input value={product.name ?? ""} onChange={(event) => updateProduct("name", event.target.value)} className="faust-field faust-focus mt-2 w-full p-3 font-normal" />
        </label>
        <label className="block text-sm font-medium">
          Category
          <input value={product.category ?? ""} onChange={(event) => updateProduct("category", event.target.value)} className="faust-field faust-focus mt-2 w-full p-3 font-normal" />
        </label>
        <label className="block text-sm font-medium">
          Supplier / shop name
          <input value={product.supplier.storeName || product.supplier.name || ""} onChange={(event) => { updateSupplier("storeName", event.target.value); updateSupplier("name", event.target.value); }} className="faust-field faust-focus mt-2 w-full p-3 font-normal" />
        </label>
        <label className="block text-sm font-medium">
          Supplier URL
          <input value={product.supplier.storeUrl ?? ""} onChange={(event) => updateSupplier("storeUrl", event.target.value)} className="faust-field faust-focus mt-2 w-full p-3 font-normal" />
        </label>
        <label className="block text-sm font-medium">
          Material
          <input value={product.material ?? ""} onChange={(event) => updateProduct("material", event.target.value)} className="faust-field faust-focus mt-2 w-full p-3 font-normal" />
        </label>
        <label className="block text-sm font-medium">
          Weight
          <input value={product.weight ?? ""} onChange={(event) => updateProduct("weight", event.target.value)} className="faust-field faust-focus mt-2 w-full p-3 font-normal" />
        </label>
        <label className="block text-sm font-medium">
          Dimensions
          <input value={product.dimensions ?? ""} onChange={(event) => updateProduct("dimensions", event.target.value)} className="faust-field faust-focus mt-2 w-full p-3 font-normal" />
        </label>
        <label className="block text-sm font-medium">
          Source price
          <input type="number" min="0" step="0.01" value={product.sourcing.sourcePrice ?? ""} onChange={(event) => updateSourceFact("sourcePrice", event.target.value ? numberValue(event.target.value) : undefined)} className="faust-field faust-focus mt-2 w-full p-3 font-normal" />
        </label>
        <label className="block text-sm font-medium">
          Available stock
          <input type="number" min="0" step="1" value={product.sourcing.stock ?? ""} onChange={(event) => updateSourceFact("stock", event.target.value ? numberValue(event.target.value) : undefined)} className="faust-field faust-focus mt-2 w-full p-3 font-normal" />
        </label>
        <label className="block text-sm font-medium">
          Minimum order quantity
          <input type="number" min="0" step="1" value={product.sourcing.minimumOrderQuantity ?? ""} onChange={(event) => updateSourceFact("minimumOrderQuantity", event.target.value ? numberValue(event.target.value) : undefined)} className="faust-field faust-focus mt-2 w-full p-3 font-normal" />
        </label>
        <label className="block text-sm font-medium">
          Package info
          <input value={product.packageInfo ?? ""} onChange={(event) => updateProduct("packageInfo", event.target.value)} className="faust-field faust-focus mt-2 w-full p-3 font-normal" />
        </label>
        <label className="block text-sm font-medium lg:col-span-2">
          Description
          <textarea rows={5} value={product.description ?? ""} onChange={(event) => updateProduct("description", event.target.value)} className="faust-field faust-focus mt-2 w-full resize-none p-3 font-normal" />
        </label>
      </div>
    </section>
  );
}
