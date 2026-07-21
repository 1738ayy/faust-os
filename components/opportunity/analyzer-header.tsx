"use client";

import { Check, ChevronLeft, ChevronRight, Download, Loader2, MoreHorizontal, Search, Sparkles, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useOpportunity } from "./opportunity-provider";
import type { ImportQueueItem } from "@/lib/import-queue";
import type { SuperbuyProduct } from "@/types/superbuy-product";

type QueueResponse = {
  success: boolean;
  queue?: ImportQueueItem[];
  counts?: { active: number; completed: number; archived: number; needsAttention: number };
  message?: string;
};

function proxiedImage(candidates: string[]) {
  const params = new URLSearchParams();
  for (const candidate of candidates) params.append("url", candidate);
  return `/api/import-image?${params.toString()}`;
}

function QueueThumbnail({ candidates, title }: { candidates: string[]; title: string }) {
  return (
    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl border border-slate-700/45 bg-zinc-950/75">
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-slate-900 via-slate-800/50 to-zinc-950" aria-hidden="true" />
      {candidates.length ? (
        <div
          aria-label={`${title} thumbnail`}
          role="img"
          className="absolute inset-0 bg-cover bg-center opacity-100 transition-opacity duration-300"
          style={{ backgroundImage: `url("${proxiedImage(candidates)}")` }}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-gradient-to-br from-[#0b1017] to-[#1f2b3f] text-[#c8d2e6]">
          <Sparkles className="h-5 w-5" />
          <span className="text-[10px]">No image</span>
        </div>
      )}
    </div>
  );
}

export function AnalyzerHeader() {
  const { opportunity, importSuperbuyProduct, resetOpportunity } = useOpportunity();
  const [importing, setImporting] = useState(false);
  const [queue, setQueue] = useState<ImportQueueItem[]>([]);
  const [counts, setCounts] = useState<QueueResponse["counts"]>({ active: 0, completed: 0, archived: 0, needsAttention: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "waiting" | "attention">("all");
  const railRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef(new Map<string, HTMLButtonElement>());
  const loadedFromExtension = useRef(false);

  const selectedQueueId = opportunity?.importQueueItemId || selectedId;

  const filteredQueue = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return queue.filter((item) => {
      const statusMatch = filter === "all" || (filter === "waiting" && item.status === "ready_for_review") || (filter === "attention" && ["failed", "needs_attention"].includes(item.status));
      const queryMatch = !normalized || item.title.toLowerCase().includes(normalized) || item.supplier.toLowerCase().includes(normalized);
      return statusMatch && queryMatch;
    });
  }, [filter, query, queue]);

  const localHandoffProduct = useCallback(() => {
    try {
      const raw = window.localStorage.getItem("faust.latestExtensionScan");
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { product?: SuperbuyProduct };
      return parsed.product || null;
    } catch {
      return null;
    }
  }, []);

  const waitForLocalHandoff = useCallback(async () => {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const product = localHandoffProduct();
      if (product) return product;
      await new Promise((resolve) => window.setTimeout(resolve, 250));
    }
    return null;
  }, [localHandoffProduct]);

  const loadQueue = useCallback(async () => {
    const response = await fetch("/api/import-queue", { cache: "no-store" });
    const data = await response.json() as QueueResponse;
    if (!response.ok || data.success === false) throw new Error(data.message || "Unable to load the import queue.");
    setQueue(data.queue || []);
    setCounts(data.counts || { active: data.queue?.length || 0, completed: 0, archived: 0, needsAttention: 0 });
    return data.queue || [];
  }, []);

  const selectQueueItem = useCallback((item: ImportQueueItem, options: { updateUrl?: boolean } = {}) => {
    setSelectedId(item.id);
    importSuperbuyProduct(item.product, item.id);
    if (options.updateUrl !== false) {
      const url = new URL(window.location.href);
      url.searchParams.set("importId", item.id);
      window.history.replaceState(null, "", url);
    }
    window.requestAnimationFrame(() => cardRefs.current.get(item.id)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" }));
  }, [importSuperbuyProduct]);

  const importLatest = useCallback(async (options: { waitForExtensionHandoff?: boolean } = {}) => {
    setImporting(true);
    try {
      const response = await fetch("/api/current-product", { cache: "no-store" });
      const data = await response.json();
      let product: SuperbuyProduct | null = response.ok ? data.product as SuperbuyProduct : null;
      let queueItemId = response.ok && typeof data.queueItemId === "string" ? data.queueItemId : undefined;
      if (!product) {
        product = options.waitForExtensionHandoff ? await waitForLocalHandoff() : localHandoffProduct();
        queueItemId = undefined;
      }
      if (!product) throw new Error(data.message ?? "No imported Superbuy product found.");
      importSuperbuyProduct(product, queueItemId);
      setSelectedId(queueItemId || null);
      await loadQueue();
      toast.success("Product ready for review", { description: response.ok ? "Faust loaded the selected saved scan." : "Faust recovered the scan from the extension handoff." });
    } catch (error) {
      toast.error("Import unavailable", { description: error instanceof Error ? error.message : "Unable to load the imported product." });
    } finally {
      setImporting(false);
    }
  }, [importSuperbuyProduct, loadQueue, localHandoffProduct, waitForLocalHandoff]);

  const removeItems = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    const selectedItem = queue.find((item) => ids.includes(item.id));
    if (ids.length > 1 && !window.confirm(`Remove ${ids.length} imports from the queue?\n\nThis removes the queued scans only. Existing catalog products will not be affected.`)) return;
    if (ids.length === 1 && selectedItem?.status !== "ready_for_review" && !window.confirm("Remove this import?\n\nThis will remove the queued import but will not affect existing products.")) return;
    const response = await fetch("/api/import-queue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", ids }) });
    const data = await response.json() as QueueResponse;
    if (!response.ok || data.success === false) throw new Error(data.message || "Unable to remove import.");
    const nextQueue = data.queue || [];
    setQueue(nextQueue);
    setCounts(data.counts || { active: nextQueue.length, completed: 0, archived: 0, needsAttention: 0 });
    setCheckedIds((current) => current.filter((id) => !ids.includes(id)));
    if (selectedQueueId && ids.includes(selectedQueueId)) {
      const next = nextQueue[0];
      if (next) selectQueueItem(next);
      else {
        setSelectedId(null);
        resetOpportunity();
        const url = new URL(window.location.href);
        url.searchParams.delete("importId");
        window.history.replaceState(null, "", url);
      }
    }
    toast.success(ids.length === 1 ? "Import removed" : `${ids.length} imports removed`);
  }, [queue, resetOpportunity, selectQueueItem, selectedQueueId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadQueue().then((loadedQueue) => {
        const params = new URLSearchParams(window.location.search);
        const requested = params.get("importId");
        const selected = loadedQueue.find((item) => item.id === requested) || loadedQueue.find((item) => item.id === selectedQueueId) || loadedQueue[0];
        if (selected && !opportunity) selectQueueItem(selected, { updateUrl: Boolean(requested) });
      }).catch((error) => toast.error("Import queue unavailable", { description: error instanceof Error ? error.message : "Unable to load queued imports." }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadQueue, opportunity, selectQueueItem, selectedQueueId]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (loadedFromExtension.current || params.get("source") !== "extension-import") return;
    loadedFromExtension.current = true;
    const timer = window.setTimeout(() => void importLatest({ waitForExtensionHandoff: true }), 0);
    return () => window.clearTimeout(timer);
  }, [importLatest]);

  useEffect(() => {
    if (!selectedQueueId) return;
    window.requestAnimationFrame(() => cardRefs.current.get(selectedQueueId)?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" }));
  }, [filteredQueue, selectedQueueId]);

  return (
    <div className="rounded-3xl border border-slate-700/45 bg-zinc-950/60 p-6 shadow-xl shadow-black/20 backdrop-blur">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c8d2e6]">Opportunity Analyzer</p>
          <h1 className="mt-2 text-3xl font-semibold">Review the buy before it becomes inventory.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Select any scan, verify the captured fields, adjust landed costs, and compare marketplace economics before saving anything to Faust.
          </p>
        </div>
        <button onClick={() => void importLatest()} disabled={importing} className="flex items-center justify-center gap-2 rounded-full bg-[#56627f] px-5 py-3 font-semibold text-white shadow-lg shadow-slate-950/30 transition hover:bg-[#66708d] disabled:cursor-wait disabled:opacity-60">
          {importing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
          {importing ? "Loading import..." : "Import latest scan"}
        </button>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-700/35 bg-black/25 p-4">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c8d2e6]">Import Queue</p>
            <h2 className="mt-1 text-lg font-semibold">Products waiting for review</h2>
            <p className="mt-1 text-xs text-muted-foreground">{counts?.completed ? `${counts.completed} completed import${counts.completed === 1 ? "" : "s"} kept out of the active queue.` : "Completed imports leave this active queue."}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-slate-400/20 bg-[#66708d]/10 px-3 py-1 text-xs text-[#f6f8ff]">
              {counts?.active ?? queue.length} scan{(counts?.active ?? queue.length) === 1 ? "" : "s"}{counts?.needsAttention ? ` · ${counts.needsAttention} need attention` : ""}
            </span>
            <button className="faust-secondary-action px-3 py-1.5 text-xs" onClick={() => setBulkMode((current) => !current)}>{bulkMode ? "Done selecting" : "Select multiple"}</button>
            {bulkMode && checkedIds.length ? <button className="faust-secondary-action px-3 py-1.5 text-xs" onClick={() => void removeItems(checkedIds)}>Remove selected</button> : null}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
          <label className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search imports by title or supplier..." className="faust-field faust-focus w-full py-2 pl-9 pr-3 text-sm" />
          </label>
          <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} className="faust-field faust-focus px-3 py-2 text-sm">
            <option value="all">All active</option>
            <option value="waiting">Waiting</option>
            <option value="attention">Needs attention</option>
          </select>
        </div>

        {filteredQueue.length ? (
          <div className="mt-4 flex items-center gap-3">
            <button aria-label="Scroll import queue left" className="hidden rounded-full border border-slate-700/60 bg-zinc-950/65 p-2 transition hover:border-slate-400/50 md:block" onClick={() => railRef.current?.scrollBy({ left: -320, behavior: "smooth" })}><ChevronLeft className="h-4 w-4" /></button>
            <div ref={railRef} className="faust-scrollbar flex snap-x gap-3 overflow-x-auto pb-3" role="listbox" aria-label="Import Queue">
              {filteredQueue.map((item) => {
                const selected = selectedQueueId === item.id;
                const checked = checkedIds.includes(item.id);
                return (
                  <button
                    key={item.id}
                    ref={(node) => { if (node) cardRefs.current.set(item.id, node); else cardRefs.current.delete(item.id); }}
                    role="option"
                    aria-selected={selected}
                    onClick={() => bulkMode ? setCheckedIds((current) => checked ? current.filter((id) => id !== item.id) : [...current, item.id]) : selectQueueItem(item)}
                    className={`min-w-[300px] max-w-[300px] snap-start rounded-2xl border p-3 text-left transition ${selected ? "border-[#c8d2e6]/70 bg-[#66708d]/15 shadow-lg shadow-[#66708d]/10" : "border-slate-700/35 bg-zinc-950/55 hover:border-slate-400/45 hover:bg-zinc-900/65"}`}
                  >
                    <div className="flex gap-3">
                      <QueueThumbnail candidates={item.imageCandidates} title={item.title} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2">
                          <p className="line-clamp-2 text-sm font-semibold">{item.title}</p>
                          {bulkMode ? <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${checked ? "border-[#c8d2e6] bg-[#66708d]" : "border-slate-600"}`}>{checked ? <Check className="h-3 w-3" /> : null}</span> : null}
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">{item.supplier}</p>
                        <p className="mt-1 text-xs text-[#edf3ff]">{item.variantCount} variant{item.variantCount === 1 ? "" : "s"} · {item.imageCount || "No"} image{item.imageCount === 1 ? "" : "s"}</p>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span className="rounded-full border border-slate-400/20 px-2 py-1 text-[11px] text-[#f6f8ff]">{selected ? "Selected" : item.status === "ready_for_review" ? "Ready" : "Needs attention"}</span>
                          <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><MoreHorizontal className="h-3.5 w-3.5" /> More</span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2 border-t border-slate-700/35 pt-3">
                      <span className="text-xs text-muted-foreground">{item.price ? `$${item.price.toFixed(2)}` : "Price needs review"}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{new Date(item.importedAt).toLocaleDateString()}</span>
                      <span
                        role="button"
                        tabIndex={0}
                        aria-label={`Remove ${item.title} from queue`}
                        className="rounded-full border border-slate-700/60 p-1.5 text-muted-foreground transition hover:border-slate-400/50 hover:text-white"
                        onClick={(event) => { event.stopPropagation(); void removeItems([item.id]); }}
                        onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); void removeItems([item.id]); } }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            <button aria-label="Scroll import queue right" className="hidden rounded-full border border-slate-700/60 bg-zinc-950/65 p-2 transition hover:border-slate-400/50 md:block" onClick={() => railRef.current?.scrollBy({ left: 320, behavior: "smooth" })}><ChevronRight className="h-4 w-4" /></button>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-600/45 bg-zinc-950/45 p-8 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-[#c8d2e6]" />
            <h3 className="mt-3 font-semibold">No products waiting for review.</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Import products from the browser extension to begin. Completed imports stay out of this active sourcing inbox.</p>
          </div>
        )}
      </div>
    </div>
  );
}
