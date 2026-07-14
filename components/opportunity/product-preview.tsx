"use client";
/* eslint-disable @next/next/no-img-element -- Superbuy image hosts are dynamic and external. */

import { ExternalLink, ImageIcon } from "lucide-react";
import { useOpportunity } from "./opportunity-provider";

export function ProductPreview() {
  const { opportunity } = useOpportunity();
  if (!opportunity) return null;
  const product = opportunity.product;
  const image = product.media.images[0];
  const facts = [
    ["Supplier", product.supplier.name || product.supplier.storeName],
    ["Factory", product.supplier.factoryName],
    ["Weight", product.weight],
    ["Package", product.packageInfo || product.packageSize],
    ["Variants", product.variants.length ? String(product.variants.length) : undefined],
  ];
  return (
    <section className="rounded-xl border border-border bg-card p-6"><h2 className="text-xl font-semibold">Imported product</h2><p className="mt-1 text-sm text-muted-foreground">The factual product record captured from Superbuy.</p>
      <div className="mt-6 flex h-72 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40">{image ? <img src={image} alt={product.name} className="h-full w-full object-cover" /> : <div className="text-center text-muted-foreground"><ImageIcon className="mx-auto h-10 w-10" /><p className="mt-3 text-sm">No product image was available</p></div>}</div>
      {product.media.images.length > 1 && <div className="mt-3 grid grid-cols-5 gap-2">{product.media.images.slice(0, 10).map((src) => <img key={src} src={src} alt="" className="aspect-square rounded-md border border-border object-cover" />)}</div>}
      <dl className="mt-7 space-y-3 text-sm">{facts.filter(([, value]) => value).map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-medium">{value}</dd></div>)}</dl>
      <div className="mt-6 grid gap-2 sm:grid-cols-2"><a href={product.sourcing.superbuyUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"><ExternalLink className="h-4 w-4" />Superbuy</a>{product.sourcing.original1688Url && <a href={product.sourcing.original1688Url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted"><ExternalLink className="h-4 w-4" />Original listing</a>}</div>
    </section>
  );
}
