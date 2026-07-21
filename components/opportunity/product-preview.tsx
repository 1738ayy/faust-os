"use client";

import { Camera, Crop, ExternalLink, MoveLeft, MoveRight, Star, X } from "lucide-react";
import { useRef, useState } from "react";
import { useOpportunity } from "./opportunity-provider";

const MAX_PHOTOS = 8;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function proxiedImage(src: string) {
  if (src.startsWith("data:")) return src;
  const params = new URLSearchParams();
  params.set("url", src);
  return `/api/import-image?${params.toString()}`;
}

function move<T>(items: T[], from: number, to: number) {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function loadBrowserImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be opened for editing."));
    image.src = src;
  });
}

export function ProductPreview() {
  const { opportunity, updateImages } = useOpportunity();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [cropIndex, setCropIndex] = useState<number | null>(null);
  const [cropRatio, setCropRatio] = useState("free");
  const [cropZoom, setCropZoom] = useState(1);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  if (!opportunity) return null;

  const product = opportunity.product;
  const images = product.media.images.slice(0, MAX_PHOTOS);
  const slots = Array.from({ length: MAX_PHOTOS }, (_, index) => images[index]);
  const cropImage = cropIndex !== null ? images[cropIndex] : undefined;
  const facts = [
    ["Supplier", product.supplier.name || product.supplier.storeName],
    ["Factory", product.supplier.factoryName],
    ["Weight", product.weight],
    ["Package", product.packageInfo || product.packageSize],
    ["Variants", product.variants.length ? String(product.variants.length) : undefined],
  ];

  function setImages(next: string[]) {
    updateImages(next.slice(0, MAX_PHOTOS));
  }

  async function addImageFiles(files: FileList | File[] | null) {
    setError("");
    if (!files?.length) return;
    const usable = Array.from(files).filter((file) => {
      if (!ACCEPTED_TYPES.has(file.type)) {
        setError("Use JPG, PNG, or WEBP images.");
        return false;
      }
      if (file.size > MAX_FILE_BYTES) {
        setError("Each image must be 8 MB or smaller.");
        return false;
      }
      return true;
    });
    const remaining = Math.max(0, MAX_PHOTOS - images.length);
    const encoded = await Promise.all(usable.slice(0, remaining).map((file) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    })));
    if (encoded.length) setImages([...images, ...encoded]);
  }

  function removeImage(index: number) {
    setImages(images.filter((_, imageIndex) => imageIndex !== index));
  }

  function reorder(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= images.length || to >= images.length) return;
    setImages(move(images, from, to));
  }

  async function saveCrop() {
    if (cropIndex === null || !cropImage) return;
    setError("");
    try {
      const image = await loadBrowserImage(proxiedImage(cropImage));
      const aspect = cropRatio === "1:1" ? 1 : cropRatio === "4:5" ? 4 / 5 : image.naturalWidth / image.naturalHeight;
      const baseWidth = Math.min(image.naturalWidth, image.naturalHeight * aspect);
      const baseHeight = baseWidth / aspect;
      const sourceWidth = Math.max(1, baseWidth / cropZoom);
      const sourceHeight = Math.max(1, baseHeight / cropZoom);
      const sourceX = Math.max(0, (image.naturalWidth - sourceWidth) / 2);
      const sourceY = Math.max(0, (image.naturalHeight - sourceHeight) / 2);
      const outputWidth = Math.min(1600, Math.round(sourceWidth));
      const outputHeight = Math.round(outputWidth / aspect);
      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image editor is not available in this browser.");
      context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight);
      setImages(images.map((src, index) => index === cropIndex ? canvas.toDataURL("image/jpeg", 0.92) : src));
      setCropIndex(null);
      setCropRatio("free");
      setCropZoom(1);
    } catch {
      setError("That image could not be cropped. Try uploading it from your computer first.");
    }
  }

  return (
    <section className="faust-surface p-6">
      <h2 className="text-xl font-semibold">Photos and source preview</h2>
      <p className="mt-1 text-sm text-muted-foreground">First slot is the Cover. Drag photos to reorder, use × to remove, or crop from the tile.</p>

      <div
        className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (event.dataTransfer.files.length) void addImageFiles(event.dataTransfer.files);
        }}
      >
        {slots.map((src, index) => src ? (
          <div
            key={`${src}-${index}`}
            className="group relative aspect-square overflow-hidden rounded-2xl border border-slate-700/45 bg-zinc-950/65 shadow-lg shadow-black/20 outline-none transition focus-within:border-[#c8d2e6]/70"
            draggable
            onDragStart={() => setDragIndex(index)}
            onDragEnd={() => setDragIndex(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              if (dragIndex !== null) reorder(dragIndex, index);
              setDragIndex(null);
            }}
          >
            <div aria-label={`${product.name} photo ${index + 1}`} role="img" className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url("${proxiedImage(src)}")` }} />
            <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2">
              {index === 0 ? <span className="inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[11px] font-semibold text-[#f6f8ff]"><Star className="h-3 w-3 text-[#c8d2e6]" />Cover</span> : <span />}
              <button type="button" aria-label={`Remove image ${index + 1}`} onClick={() => removeImage(index)} className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-600/60 bg-black/70 text-white transition hover:border-[#c8d2e6]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent p-2 pt-8 opacity-100">
              <button type="button" aria-label={`Crop image ${index + 1}`} onClick={() => setCropIndex(index)} className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-600/60 bg-black/70 text-white transition hover:border-[#c8d2e6]">
                <Crop className="h-4 w-4" />
              </button>
              <div className="flex gap-1">
                <button type="button" aria-label={`Move image ${index + 1} left`} disabled={index === 0} onClick={() => reorder(index, index - 1)} className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-600/60 bg-black/70 text-white transition hover:border-[#c8d2e6] disabled:opacity-35">
                  <MoveLeft className="h-4 w-4" />
                </button>
                <button type="button" aria-label={`Move image ${index + 1} right`} disabled={index === images.length - 1} onClick={() => reorder(index, index + 1)} className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-600/60 bg-black/70 text-white transition hover:border-[#c8d2e6] disabled:opacity-35">
                  <MoveRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button key={`empty-${index}`} type="button" onClick={() => fileInputRef.current?.click()} className="aspect-square rounded-2xl border border-dashed border-slate-600/60 bg-zinc-950/45 p-4 text-center text-sm text-muted-foreground transition hover:border-[#c8d2e6]/70 hover:text-[#f6f8ff] focus-visible:border-[#c8d2e6]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#66708d]/40">
            <Camera className="mx-auto h-7 w-7 text-[#c8d2e6]" />
            <span className="mt-3 block font-semibold">Add a photo</span>
            <span className="mt-1 block text-xs">JPG, PNG, WEBP</span>
          </button>
        ))}
      </div>

      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(event) => void addImageFiles(event.target.files)} />
      {error ? <p role="status" className="mt-3 text-sm text-amber-200">{error}</p> : null}
      {!images.length ? <p className="mt-4 text-sm text-muted-foreground">Add at least one product image before creating the product.</p> : null}

      <dl className="mt-7 space-y-3 text-sm">{facts.filter(([, value]) => value).map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-medium">{value}</dd></div>)}</dl>
      <div className="mt-6 grid gap-2 sm:grid-cols-2"><a href={product.sourcing.superbuyUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-full border border-slate-700/60 bg-zinc-950/50 px-3 py-2 text-sm font-medium transition hover:border-slate-400/50 hover:text-white"><ExternalLink className="h-4 w-4" />Superbuy</a>{product.sourcing.original1688Url && <a href={product.sourcing.original1688Url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-full border border-slate-700/60 bg-zinc-950/50 px-3 py-2 text-sm font-medium transition hover:border-slate-400/50 hover:text-white"><ExternalLink className="h-4 w-4" />Original listing</a>}</div>

      {cropImage ? (
        <div role="dialog" aria-modal="true" aria-label="Crop photo" className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5" onKeyDown={(event) => { if (event.key === "Escape") setCropIndex(null); }}>
          <div className="faust-surface w-full max-w-xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div><h3 className="text-lg font-semibold">Crop photo</h3><p className="mt-1 text-sm text-muted-foreground">Crop settings are saved with this import draft. Original supplier images stay unchanged.</p></div>
              <button type="button" aria-label="Close crop editor" className="faust-secondary-action px-3 py-2" onClick={() => setCropIndex(null)}><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-5 overflow-hidden rounded-2xl border border-slate-700/45 bg-black/35">
              <div className="aspect-square bg-contain bg-center bg-no-repeat transition-transform" style={{ backgroundImage: `url("${proxiedImage(cropImage)}")`, transform: `scale(${cropZoom})` }} />
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium">Crop ratio<select value={cropRatio} onChange={(event) => setCropRatio(event.target.value)} className="faust-field faust-focus mt-2 w-full p-3"><option value="free">Free crop</option><option value="1:1">Square 1:1</option><option value="4:5">Portrait 4:5</option></select></label>
              <label className="text-sm font-medium">Zoom<input type="range" min="1" max="2" step="0.05" value={cropZoom} onChange={(event) => setCropZoom(Number(event.target.value))} className="mt-4 w-full accent-[#66708d]" /></label>
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button type="button" className="faust-secondary-action" onClick={() => { setCropRatio("free"); setCropZoom(1); }}>Reset</button>
              <button type="button" className="faust-secondary-action" onClick={() => setCropIndex(null)}>Cancel</button>
              <button type="button" className="faust-action" onClick={() => void saveCrop()}>Save crop</button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
