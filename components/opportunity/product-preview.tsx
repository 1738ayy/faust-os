"use client";
/* eslint-disable @next/next/no-img-element -- Superbuy image hosts are dynamic and external. */

import { ExternalLink, ImageIcon } from "lucide-react";
import { useState } from "react";
import { useOpportunity } from "./opportunity-provider";

export function ProductPreview() {
  const { opportunity, updateImages } = useOpportunity();
  const [imageUrl, setImageUrl] = useState("");
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
  function addImage() {
    const next = imageUrl.trim();
    if (!next) return;
    updateImages([...product.media.images, next]);
    setImageUrl("");
  }
  async function addImageFiles(files: FileList | null) {
    if (!files?.length) return;
    const encoded = await Promise.all(Array.from(files).map((file) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    })));
    updateImages([...product.media.images, ...encoded]);
  }
  function removeImage(src: string) {
    updateImages(product.media.images.filter((imageSrc) => imageSrc !== src));
  }
  function makePrimary(src: string) {
    updateImages([src, ...product.media.images.filter((imageSrc) => imageSrc !== src)]);
  }
  return (
    <section className="faust-surface p-6"><h2 className="text-xl font-semibold">Imported product</h2><p className="mt-1 text-sm text-muted-foreground">The factual product record captured from Superbuy.</p>
      <div className="mt-6 flex h-72 items-center justify-center overflow-hidden rounded-3xl border border-sky-950/45 bg-black/35">{image ? <img src={image} alt={product.name} className="h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <div className="text-center text-muted-foreground"><ImageIcon className="mx-auto h-10 w-10 text-sky-200" /><p className="mt-3 text-sm">No product image was available</p></div>}</div>
      <div className="mt-4 rounded-2xl border border-sky-950/35 bg-black/25 p-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex-1 text-sm font-medium">
            Add image URL
            <input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="Paste a product image URL" className="faust-field faust-focus mt-2 w-full p-3 font-normal" />
          </label>
          <button type="button" onClick={addImage} className="mt-auto rounded-full bg-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-950/30 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60" disabled={!imageUrl.trim()}>
            Add image
          </button>
        </div>
        <label className="mt-3 block cursor-pointer rounded-2xl border border-dashed border-sky-950/60 bg-zinc-950/40 p-4 text-center text-sm text-muted-foreground transition hover:border-sky-400/50 hover:text-sky-50">
          Upload images from computer
          <input type="file" accept="image/*" multiple className="sr-only" onChange={(event) => void addImageFiles(event.target.files)} />
        </label>
        {product.media.images.length ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
            {product.media.images.slice(0, 15).map((src, index) => (
              <div key={src} className="overflow-hidden rounded-2xl border border-sky-950/45 bg-zinc-950/60">
                <img src={src} alt="" className="aspect-square w-full object-cover" onError={(event) => { event.currentTarget.closest("div")?.remove(); }} />
                <div className="grid grid-cols-2 gap-1 p-2 text-[11px]">
                  <button type="button" onClick={() => makePrimary(src)} disabled={index === 0} className="rounded-full border border-sky-950/60 px-2 py-1 text-sky-50 transition hover:border-sky-400/50 disabled:cursor-default disabled:opacity-50">
                    {index === 0 ? "Primary" : "Make first"}
                  </button>
                  <button type="button" onClick={() => removeImage(src)} className="rounded-full border border-sky-950/60 px-2 py-1 text-sky-50 transition hover:border-sky-400/50">
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="mt-4 text-sm text-muted-foreground">Add at least one product image before creating the product.</p>}
      </div>
      <dl className="mt-7 space-y-3 text-sm">{facts.filter(([, value]) => value).map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-medium">{value}</dd></div>)}</dl>
      <div className="mt-6 grid gap-2 sm:grid-cols-2"><a href={product.sourcing.superbuyUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-full border border-sky-950/60 bg-zinc-950/50 px-3 py-2 text-sm font-medium transition hover:border-sky-400/50 hover:text-white"><ExternalLink className="h-4 w-4" />Superbuy</a>{product.sourcing.original1688Url && <a href={product.sourcing.original1688Url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-full border border-sky-950/60 bg-zinc-950/50 px-3 py-2 text-sm font-medium transition hover:border-sky-400/50 hover:text-white"><ExternalLink className="h-4 w-4" />Original listing</a>}</div>
    </section>
  );
}
