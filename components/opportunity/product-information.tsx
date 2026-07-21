"use client";

import { useEffect, useMemo, useState } from "react";
import { useOpportunity } from "./opportunity-provider";

const SKU_PATTERN = /^[A-Za-z0-9_-]+$/;

export function ProductInformation() {
  const { opportunity, updateProduct, updateSupplier, updateSourceFact } = useOpportunity();
  const [skuStatus, setSkuStatus] = useState<"idle" | "available" | "duplicate">("idle");
  const product = opportunity?.product;
  const sku = product?.sku || "";
  const skuMessage = useMemo(() => {
    if (!sku.trim()) return "SKU is required before creating the product.";
    if (!SKU_PATTERN.test(sku.trim())) return "Use letters, numbers, hyphens, or underscores.";
    if (skuStatus === "duplicate") return "SKU already exists. Choose another SKU.";
    if (skuStatus === "available") return "SKU available.";
    return "You can replace Faust's suggested SKU with your own.";
  }, [sku, skuStatus]);

  useEffect(() => {
    if (!opportunity) return;
    const trimmed = sku.trim();
    if (!trimmed || !SKU_PATTERN.test(trimmed)) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/products/actions?sku=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        const data = await response.json() as { available?: boolean };
        setSkuStatus(data.available ? "available" : "duplicate");
      } catch {
        if (!controller.signal.aborted) setSkuStatus("idle");
      }
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [opportunity, sku]);
  if (!opportunity || !product) return null;
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
          SKU
          <input value={sku} onChange={(event) => updateProduct("sku", event.target.value)} className="faust-field faust-focus mt-2 w-full p-3 font-normal" />
          <span className={`mt-2 block text-xs ${skuStatus === "duplicate" || !sku.trim() || !SKU_PATTERN.test(sku.trim()) ? "text-amber-200" : skuStatus === "available" ? "text-[#c8d2e6]" : "text-muted-foreground"}`}>{skuMessage}</span>
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
