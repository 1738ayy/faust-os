"use client";
/* eslint-disable @next/next/no-img-element -- The crop editor needs direct access to rendered image bounds for canvas output. */

import { Camera, ChevronLeft, ChevronRight, Crop, ExternalLink, Maximize2, MoveLeft, MoveRight, Star, X } from "lucide-react";
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

const DEFAULT_MAX_PHOTOS = 12;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MIN_CROP_PX = 80;

type CropRatio = "free" | "1:1" | "4:5" | "3:4" | "16:9";
type CropBox = { x: number; y: number; width: number; height: number };
type DragMode = "move" | "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";
type CropTransform = { box: CropBox; ratio: CropRatio; zoom: number };
export type ProductImageCropRecord = { original: string; transform: CropTransform; croppedAt: string };
type CropState = { index: number; original: string; box: CropBox; ratio: CropRatio; zoom: number; drag?: { mode: DragMode; pointerId: number; startX: number; startY: number; startBox: CropBox } };

type ProductImageManagerProps = {
  title?: string;
  description?: string;
  productName: string;
  images: string[];
  onChange: (images: string[]) => void;
  maxPhotos?: number;
  storageKey?: string;
  facts?: [string, string | number | undefined][];
  links?: { label: string; href?: string }[];
  compact?: boolean;
};

const defaultCropBox: CropBox = { x: 10, y: 10, width: 80, height: 80 };

export function proxiedProductImage(src: string) {
  if (src.startsWith("data:")) return src;
  if (src.startsWith("/api/import-image?key=") || src.startsWith("/api/import-image?storageKey=")) return src;
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

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function ratioValue(ratio: CropRatio) {
  if (ratio === "1:1") return 1;
  if (ratio === "4:5") return 4 / 5;
  if (ratio === "3:4") return 3 / 4;
  if (ratio === "16:9") return 16 / 9;
  return undefined;
}

function cropMetadataKey(storageKey?: string) {
  return storageKey ? `faust.productImageCrops.${storageKey}` : undefined;
}

function readCropRecords(storageKey?: string): Record<string, ProductImageCropRecord> {
  const key = cropMetadataKey(storageKey);
  if (!key || typeof window === "undefined") return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(key) || "{}") as Record<string, ProductImageCropRecord>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveCropRecord(storageKey: string | undefined, editedImage: string, record: ProductImageCropRecord) {
  const key = cropMetadataKey(storageKey);
  if (!key || typeof window === "undefined") return;
  try {
    const records = readCropRecords(storageKey);
    window.localStorage.setItem(key, JSON.stringify({ ...records, [editedImage]: record, [record.original]: record }));
  } catch {
    // The cropped image itself is persisted in the product draft/product record.
  }
}

function cropBoxForRatio(box: CropBox, ratio: CropRatio, stage: DOMRect): CropBox {
  const aspect = ratioValue(ratio);
  if (!aspect) return box;
  const widthPx = (box.width / 100) * stage.width;
  const heightPx = widthPx / aspect;
  const height = clamp((heightPx / stage.height) * 100, (MIN_CROP_PX / stage.height) * 100, 100);
  return clampBox({ ...box, height }, stage);
}

function clampBox(box: CropBox, stage: DOMRect): CropBox {
  const minWidth = Math.min(100, (MIN_CROP_PX / stage.width) * 100);
  const minHeight = Math.min(100, (MIN_CROP_PX / stage.height) * 100);
  const width = clamp(box.width, minWidth, 100);
  const height = clamp(box.height, minHeight, 100);
  const x = clamp(box.x, 0, 100 - width);
  const y = clamp(box.y, 0, 100 - height);
  return { x, y, width, height };
}

function resizeFree(box: CropBox, mode: DragMode, dx: number, dy: number, stage: DOMRect) {
  const next = { ...box };
  if (mode.includes("e")) next.width += dx;
  if (mode.includes("s")) next.height += dy;
  if (mode.includes("w")) {
    next.x += dx;
    next.width -= dx;
  }
  if (mode.includes("n")) {
    next.y += dy;
    next.height -= dy;
  }
  return clampBox(next, stage);
}

function resizeLocked(box: CropBox, mode: DragMode, dxPct: number, dyPct: number, stage: DOMRect, ratio: CropRatio) {
  const aspect = ratioValue(ratio);
  if (!aspect || mode === "move") return box;
  const start = { x: (box.x / 100) * stage.width, y: (box.y / 100) * stage.height, width: (box.width / 100) * stage.width, height: (box.height / 100) * stage.height };
  const dx = (dxPct / 100) * stage.width;
  const dy = (dyPct / 100) * stage.height;
  let width = start.width;
  if (mode.includes("e")) width = start.width + dx;
  else if (mode.includes("w")) width = start.width - dx;
  else if (mode === "n" || mode === "s") width = (start.height + (mode === "s" ? dy : -dy)) * aspect;
  width = clamp(width, MIN_CROP_PX, stage.width);
  let height = width / aspect;
  if (height > stage.height) {
    height = stage.height;
    width = height * aspect;
  }
  let x = start.x;
  let y = start.y;
  if (mode.includes("w")) x = start.x + start.width - width;
  if (mode.includes("n")) y = start.y + start.height - height;
  if (mode === "e" || mode === "w") y = start.y + (start.height - height) / 2;
  if (mode === "n" || mode === "s") x = start.x + (start.width - width) / 2;
  return clampBox({ x: (x / stage.width) * 100, y: (y / stage.height) * 100, width: (width / stage.width) * 100, height: (height / stage.height) * 100 }, stage);
}

function loadBrowserImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Image could not be opened for editing."));
    image.src = src;
  });
}

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Image crop could not be prepared for upload.")), "image/jpeg", 0.92);
  });
}

async function uploadProductImage(file: Blob, filename: string) {
  const form = new FormData();
  form.set("file", file, filename);
  const response = await fetch("/api/import-image", { method: "POST", body: form });
  const payload = await response.json() as { ok?: boolean; url?: string; message?: string };
  if (!response.ok || !payload.ok || !payload.url) throw new Error(payload.message || "This image could not be uploaded. Please retry before publishing.");
  return payload.url;
}

export function ProductImageManager({ title = "Photos", description = "First slot is the Cover. Drag photos to reorder, use × to remove, or crop from the tile.", productName, images, onChange, maxPhotos = DEFAULT_MAX_PHOTOS, storageKey, facts = [], links = [], compact = false }: ProductImageManagerProps) {
  const cleanImages = images.slice(0, maxPhotos);
  const slots = Array.from({ length: maxPhotos }, (_, index) => cleanImages[index]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [cropState, setCropState] = useState<CropState | null>(null);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const railRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const visibleSlots = compact ? [...cleanImages, undefined].slice(0, maxPhotos) : slots;

  function setImages(next: string[]) {
    onChange(Array.from(new Set(next.map((image) => image.trim()).filter(Boolean))).slice(0, maxPhotos));
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
    const remaining = Math.max(0, maxPhotos - cleanImages.length);
    setUploading(true);
    try {
      const uploaded = await Promise.all(usable.slice(0, remaining).map((file) => uploadProductImage(file, file.name || "product-image.jpg")));
      if (uploaded.length) setImages([...cleanImages, ...uploaded]);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "This image could not be uploaded. Please retry before publishing.");
    } finally {
      setUploading(false);
    }
  }

  function removeImage(index: number) {
    setImages(cleanImages.filter((_, imageIndex) => imageIndex !== index));
  }

  function reorder(from: number, to: number) {
    if (from === to || from < 0 || to < 0 || from >= cleanImages.length || to >= cleanImages.length) return;
    setImages(move(cleanImages, from, to));
  }

  function openCrop(index: number) {
    const source = cleanImages[index];
    const records = readCropRecords(storageKey);
    const record = records[source];
    setError("");
    setCropState({ index, original: record?.original || source, box: record?.transform.box || defaultCropBox, ratio: record?.transform.ratio || "free", zoom: record?.transform.zoom || 1 });
  }

  function updateCropBox(nextBox: CropBox) {
    const stage = stageRef.current?.getBoundingClientRect();
    if (!stage) return;
    setCropState((current) => current ? { ...current, box: cropBoxForRatio(clampBox(nextBox, stage), current.ratio, stage) } : current);
  }

  function startCropDrag(mode: DragMode, event: ReactPointerEvent<HTMLElement>) {
    if (!cropState) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setCropState({ ...cropState, drag: { mode, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, startBox: cropState.box } });
  }

  function dragCrop(event: ReactPointerEvent<HTMLElement>) {
    if (!cropState?.drag) return;
    const stage = stageRef.current?.getBoundingClientRect();
    if (!stage) return;
    const dx = ((event.clientX - cropState.drag.startX) / stage.width) * 100;
    const dy = ((event.clientY - cropState.drag.startY) / stage.height) * 100;
    const box = cropState.drag.mode === "move" ? clampBox({ ...cropState.drag.startBox, x: cropState.drag.startBox.x + dx, y: cropState.drag.startBox.y + dy }, stage) : cropState.ratio === "free" ? resizeFree(cropState.drag.startBox, cropState.drag.mode, dx, dy, stage) : resizeLocked(cropState.drag.startBox, cropState.drag.mode, dx, dy, stage, cropState.ratio);
    setCropState({ ...cropState, box });
  }

  function endCropDrag() {
    setCropState((current) => current ? { ...current, drag: undefined } : current);
  }

  function setCropRatio(ratio: CropRatio) {
    const stage = stageRef.current?.getBoundingClientRect();
    setCropState((current) => current ? { ...current, ratio, box: stage ? cropBoxForRatio(current.box, ratio, stage) : current.box } : current);
  }

  function setCropZoom(zoom: number) {
    setCropState((current) => current ? { ...current, zoom: clamp(zoom, 1, 2.5) } : current);
  }

  function resetCrop() {
    setCropState((current) => current ? { ...current, box: defaultCropBox, ratio: "free", zoom: 1 } : current);
  }

  async function saveCrop() {
    if (!cropState || !stageRef.current || !imageRef.current) return;
    setError("");
    try {
      const stage = stageRef.current.getBoundingClientRect();
      const imageRect = imageRef.current.getBoundingClientRect();
      const boxRect = { left: stage.left + (cropState.box.x / 100) * stage.width, top: stage.top + (cropState.box.y / 100) * stage.height, width: (cropState.box.width / 100) * stage.width, height: (cropState.box.height / 100) * stage.height };
      const image = await loadBrowserImage(proxiedProductImage(cropState.original));
      const sourceX = clamp(((boxRect.left - imageRect.left) / imageRect.width) * image.naturalWidth, 0, image.naturalWidth - 1);
      const sourceY = clamp(((boxRect.top - imageRect.top) / imageRect.height) * image.naturalHeight, 0, image.naturalHeight - 1);
      const sourceWidth = clamp((boxRect.width / imageRect.width) * image.naturalWidth, 1, image.naturalWidth - sourceX);
      const sourceHeight = clamp((boxRect.height / imageRect.height) * image.naturalHeight, 1, image.naturalHeight - sourceY);
      const outputWidth = Math.min(1800, Math.round(sourceWidth));
      const outputHeight = Math.max(1, Math.round(outputWidth * (sourceHeight / sourceWidth)));
      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image editor is not available in this browser.");
      context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, outputWidth, outputHeight);
      setUploading(true);
      const editedImage = await uploadProductImage(await canvasBlob(canvas), `product-crop-${cropState.index + 1}.jpg`);
      saveCropRecord(storageKey, editedImage, { original: cropState.original, transform: { box: cropState.box, ratio: cropState.ratio, zoom: cropState.zoom }, croppedAt: new Date().toISOString() });
      setImages(cleanImages.map((src, index) => index === cropState.index ? editedImage : src));
      setCropState(null);
    } catch (cropError) {
      setError(cropError instanceof Error ? cropError.message : "That image could not be cropped. Try uploading it from your computer first.");
    } finally {
      setUploading(false);
    }
  }

  function handleCropKeys(event: React.KeyboardEvent<HTMLElement>) {
    if (!cropState) return;
    const stage = stageRef.current?.getBoundingClientRect();
    if (!stage) return;
    const step = event.shiftKey ? 4 : 1;
    if (event.key === "Escape") { event.preventDefault(); setCropState(null); return; }
    if (event.key === "Enter") { event.preventDefault(); void saveCrop(); return; }
    if (event.key === "+" || event.key === "=") { event.preventDefault(); setCropZoom(cropState.zoom + 0.05); return; }
    if (event.key === "-") { event.preventDefault(); setCropZoom(cropState.zoom - 0.05); return; }
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const deltaX = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
    const deltaY = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
    updateCropBox(event.altKey ? clampBox({ ...cropState.box, width: cropState.box.width + deltaX, height: cropState.box.height + deltaY }, stage) : clampBox({ ...cropState.box, x: cropState.box.x + deltaX, y: cropState.box.y + deltaY }, stage));
  }

  return (
    <section className={compact ? "space-y-3" : "faust-surface p-6"}>
      <div className={compact ? "flex items-start justify-between gap-3" : ""}>
        <div>
          <h2 className={compact ? "text-base font-semibold" : "text-xl font-semibold"}>{title}</h2>
          <p className={compact ? "mt-1 max-w-xl text-xs leading-5 text-muted-foreground" : "mt-1 text-sm text-muted-foreground"}>{description}</p>
        </div>
        {compact ? (
          <button type="button" disabled={uploading} onClick={() => setExpanded(true)} className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-700/60 bg-zinc-950/55 px-3 py-2 text-xs font-semibold text-[#f6f8ff] transition hover:border-[#c8d2e6]/70 focus-visible:border-[#c8d2e6]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#66708d]/40 disabled:opacity-50">
            <Maximize2 className="h-3.5 w-3.5" />Manage Photos
          </button>
        ) : null}
      </div>
      <div className={compact ? "relative" : ""}>
        {compact && visibleSlots.length > 3 ? (
          <button type="button" aria-label="Scroll photos left" onClick={() => railRef.current?.scrollBy({ left: -180, behavior: "smooth" })} className="absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-slate-700/60 bg-black/70 p-2 text-[#f6f8ff] shadow-lg shadow-black/40 transition hover:border-[#c8d2e6]/70 md:block">
            <ChevronLeft className="h-4 w-4" />
          </button>
        ) : null}
        <div
          ref={railRef}
          className={compact ? "faust-scrollbar flex snap-x gap-3 overflow-x-auto pb-2 md:px-8" : "mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4"}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (event.dataTransfer.files.length) void addImageFiles(event.dataTransfer.files);
          }}
        >
          {visibleSlots.map((src, index) => src ? (
            <div
              key={`${src}-${index}`}
              className={`group relative shrink-0 snap-start overflow-hidden rounded-2xl border bg-zinc-950/65 shadow-lg shadow-black/20 outline-none transition focus-within:border-[#c8d2e6]/70 hover:-translate-y-0.5 hover:border-[#c8d2e6]/55 ${compact ? index === 0 ? "h-36 w-44 border-[#c8d2e6]/55 shadow-[#66708d]/15 md:h-40 md:w-52" : "h-36 w-28 border-slate-700/45 md:h-40 md:w-32" : "aspect-square border-slate-700/45"}`}
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
              <div aria-label={`${productName} photo ${index + 1}`} role="img" className="absolute inset-0 bg-cover bg-center transition duration-300 group-hover:scale-[1.02]" style={{ backgroundImage: `url("${proxiedProductImage(src)}")` }} />
              <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2">
                {index === 0 ? <span className="inline-flex items-center gap-1 rounded-full bg-black/75 px-2 py-1 text-[11px] font-semibold text-[#f6f8ff]"><Star className="h-3 w-3 text-[#c8d2e6]" />Cover</span> : <span className="rounded-full bg-black/65 px-2 py-1 text-[11px] font-semibold text-[#c8d2e6]">{index === 1 ? "Front" : index === 2 ? "Detail" : index === 3 ? "Back" : `Photo ${index + 1}`}</span>}
                <button type="button" aria-label={`Remove image ${index + 1}`} onClick={() => removeImage(index)} className={`flex h-8 w-8 items-center justify-center rounded-full border border-slate-600/60 bg-black/70 text-white transition hover:border-[#c8d2e6] ${compact ? "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100" : ""}`}>
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className={`absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent p-2 pt-8 transition ${compact ? "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100" : "opacity-100"}`}>
                <button type="button" aria-label={`Crop image ${index + 1}`} onClick={() => openCrop(index)} className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-600/60 bg-black/70 text-white transition hover:border-[#c8d2e6]">
                  <Crop className="h-4 w-4" />
                </button>
                <div className="flex gap-1">
                  <button type="button" aria-label={`Move image ${index + 1} left`} disabled={index === 0} onClick={() => reorder(index, index - 1)} className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-600/60 bg-black/70 text-white transition hover:border-[#c8d2e6] disabled:opacity-35">
                    <MoveLeft className="h-4 w-4" />
                  </button>
                  <button type="button" aria-label={`Move image ${index + 1} right`} disabled={index === cleanImages.length - 1} onClick={() => reorder(index, index + 1)} className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-600/60 bg-black/70 text-white transition hover:border-[#c8d2e6] disabled:opacity-35">
                    <MoveRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button key={`empty-${index}`} type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()} className={`${compact ? "h-36 w-28 shrink-0 snap-start md:h-40 md:w-32" : "aspect-square"} rounded-2xl border border-dashed border-slate-600/60 bg-zinc-950/45 p-4 text-center text-sm text-muted-foreground transition hover:border-[#c8d2e6]/70 hover:text-[#f6f8ff] focus-visible:border-[#c8d2e6]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#66708d]/40 disabled:opacity-50`}>
              <Camera className={`${compact ? "h-6 w-6" : "h-7 w-7"} mx-auto text-[#c8d2e6]`} />
              <span className="mt-3 block font-semibold">{uploading ? "Uploading..." : "Add photo"}</span>
              <span className="mt-1 block text-xs">{compact ? "Upload" : "JPG, PNG, WEBP"}</span>
            </button>
          ))}
        </div>
        {compact && visibleSlots.length > 3 ? (
          <button type="button" aria-label="Scroll photos right" onClick={() => railRef.current?.scrollBy({ left: 180, behavior: "smooth" })} className="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-slate-700/60 bg-black/70 p-2 text-[#f6f8ff] shadow-lg shadow-black/40 transition hover:border-[#c8d2e6]/70 md:block">
            <ChevronRight className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(event) => void addImageFiles(event.target.files)} />
      {uploading ? <p role="status" className="mt-2 text-sm text-muted-foreground">Uploading image before saving it to the product...</p> : null}
      {error ? <p role="status" className="mt-2 text-sm text-amber-200">{error}</p> : null}
      {!cleanImages.length ? <p className={compact ? "text-xs text-muted-foreground" : "mt-4 text-sm text-muted-foreground"}>No product photos yet. Upload photos to create a cover and marketplace image set.</p> : null}
      {facts.length ? <dl className="mt-7 space-y-3 text-sm">{facts.filter(([, value]) => value !== undefined && value !== "").map(([label, value]) => <div key={label} className="flex justify-between gap-4"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-medium">{value}</dd></div>)}</dl> : null}
      {links.length ? <div className="mt-6 grid gap-2 sm:grid-cols-2">{links.filter((link) => link.href).map((link) => <a key={link.label} href={link.href} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-full border border-slate-700/60 bg-zinc-950/50 px-3 py-2 text-sm font-medium transition hover:border-slate-400/50 hover:text-white"><ExternalLink className="h-4 w-4" />{link.label}</a>)}</div> : null}
      {compact && expanded ? (
        <div role="dialog" aria-modal="true" aria-label="Manage product photos" className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-5">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-[2rem] border border-slate-700/45 bg-[#080b10] p-5 shadow-2xl shadow-black/70">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div><h3 className="text-xl font-semibold">Manage Photos</h3><p className="mt-1 text-sm text-muted-foreground">Use the full image manager for upload, crop, reorder, replace, delete, cover selection, and image-purpose work.</p></div>
              <button type="button" aria-label="Close photo manager" className="faust-secondary-action px-3 py-2" onClick={() => setExpanded(false)}><X className="h-4 w-4" /></button>
            </div>
            <ProductImageManager title={title} description={description} productName={productName} images={images} onChange={onChange} maxPhotos={maxPhotos} storageKey={storageKey} facts={facts} links={links} compact={false} />
          </div>
        </div>
      ) : null}
      {cropState ? (
        <div role="dialog" aria-modal="true" aria-label="Crop photo" className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-5" onKeyDown={handleCropKeys}>
          <div className="faust-surface w-full max-w-4xl p-5 shadow-2xl shadow-slate-950/80">
            <div className="flex items-start justify-between gap-4">
              <div><h3 className="text-lg font-semibold">Crop photo</h3><p className="mt-1 text-sm text-muted-foreground">Drag the box, edges, or corners. What stays inside the box becomes the final photo.</p></div>
              <button type="button" aria-label="Close crop editor" className="faust-secondary-action px-3 py-2" onClick={() => setCropState(null)}><X className="h-4 w-4" /></button>
            </div>
            <div ref={stageRef} className="relative mt-5 flex h-[min(68vh,680px)] touch-none select-none items-center justify-center overflow-hidden rounded-3xl border border-slate-700/45 bg-black/45 outline-none" tabIndex={0} role="application" aria-label="Photo crop area. Drag the crop box or handles. Arrow keys move the crop. Alt plus arrow resizes. Enter saves. Escape cancels." onPointerMove={dragCrop} onPointerUp={endCropDrag} onPointerCancel={endCropDrag} onWheel={(event) => { if (!event.ctrlKey) return; event.preventDefault(); setCropZoom(cropState.zoom + (event.deltaY < 0 ? 0.05 : -0.05)); }}>
              <img ref={imageRef} src={proxiedProductImage(cropState.original)} alt="" className="max-h-full max-w-full object-contain transition-transform" style={{ transform: `scale(${cropState.zoom})` }} draggable={false} />
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-0 right-0 top-0 bg-black/55" style={{ height: `${cropState.box.y}%` }} />
                <div className="absolute left-0 bg-black/55" style={{ top: `${cropState.box.y}%`, width: `${cropState.box.x}%`, height: `${cropState.box.height}%` }} />
                <div className="absolute right-0 bg-black/55" style={{ top: `${cropState.box.y}%`, width: `${100 - cropState.box.x - cropState.box.width}%`, height: `${cropState.box.height}%` }} />
                <div className="absolute bottom-0 left-0 right-0 bg-black/55" style={{ height: `${100 - cropState.box.y - cropState.box.height}%` }} />
              </div>
              <div role="region" aria-label="Selected crop area" className="absolute cursor-move border border-[#c8d2e6] shadow-[0_0_0_1px_rgba(200,210,230,0.25),0_0_30px_rgba(102,112,141,0.35)] focus:outline-none" style={{ left: `${cropState.box.x}%`, top: `${cropState.box.y}%`, width: `${cropState.box.width}%`, height: `${cropState.box.height}%` }} tabIndex={0} onPointerDown={(event) => startCropDrag("move", event)}>
                <div className="pointer-events-none absolute inset-0 border border-black/45" />
                {(["nw", "ne", "sw", "se"] as const).map((corner) => <button key={corner} type="button" aria-label={`Resize crop from ${corner.toUpperCase()} corner`} className={`absolute h-5 w-5 rounded-full border border-[#f6f8ff] bg-[#66708d] shadow-lg shadow-black/40 ${corner.includes("n") ? "-top-2.5" : "-bottom-2.5"} ${corner.includes("w") ? "-left-2.5" : "-right-2.5"}`} style={{ cursor: `${corner}-resize` }} onPointerDown={(event) => startCropDrag(corner, event)} />)}
                {(["n", "s", "e", "w"] as const).map((edge) => <button key={edge} type="button" aria-label={`Resize crop from ${edge.toUpperCase()} edge`} className={`absolute rounded-full border border-[#c8d2e6]/80 bg-[#66708d]/90 ${edge === "n" || edge === "s" ? "left-1/2 h-3 w-12 -translate-x-1/2" : "top-1/2 h-12 w-3 -translate-y-1/2"} ${edge === "n" ? "-top-1.5" : ""} ${edge === "s" ? "-bottom-1.5" : ""} ${edge === "e" ? "-right-1.5" : ""} ${edge === "w" ? "-left-1.5" : ""}`} style={{ cursor: `${edge}-resize` }} onPointerDown={(event) => startCropDrag(edge, event)} />)}
              </div>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
              <label className="text-sm font-medium">Crop shape<select value={cropState.ratio} onChange={(event) => setCropRatio(event.target.value as CropRatio)} className="faust-field faust-focus mt-2 w-full p-3"><option value="free">Free crop</option><option value="1:1">Square 1:1</option><option value="4:5">Portrait 4:5</option><option value="3:4">Portrait 3:4</option><option value="16:9">Wide 16:9</option></select></label>
              <label className="text-sm font-medium">Zoom<input type="range" min="1" max="2.5" step="0.05" value={cropState.zoom} onChange={(event) => setCropZoom(Number(event.target.value))} className="mt-4 w-full accent-[#66708d]" /></label>
              <div className="flex flex-wrap items-end justify-end gap-2">
                <button type="button" className="faust-secondary-action" onClick={resetCrop}>Reset Crop</button>
                <button type="button" className="faust-secondary-action" onClick={() => setCropState(null)}>Cancel</button>
                <button type="button" disabled={uploading} className="faust-action disabled:opacity-50" onClick={() => void saveCrop()}>{uploading ? "Uploading..." : "Save crop"}</button>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Keyboard: arrows move, Shift moves faster, Alt + arrows resizes, + / - zooms, Enter saves, Escape cancels.</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
