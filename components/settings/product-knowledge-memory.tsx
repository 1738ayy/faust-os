"use client";

import { useState, useTransition } from "react";
import type { ProductKnowledgeMemory } from "@/domain/business";
import { StatusBadge } from "@/components/faust/design-system";

export function ProductKnowledgeMemoryControls({ memories }: { memories: ProductKnowledgeMemory[] }) {
  const [items, setItems] = useState(memories);
  const [pending, startTransition] = useTransition();

  const act = (memory: ProductKnowledgeMemory, memoryAction: "suspend" | "restore" | "delete") => {
    startTransition(async () => {
      const response = await fetch("/api/products/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "manage-knowledge-memory", memoryId: memory.id, memoryAction }),
      });
      if (!response.ok) return;
      setItems((current) => memoryAction === "delete"
        ? current.filter((entry) => entry.id !== memory.id)
        : current.map((entry) => entry.id === memory.id ? { ...entry, status: memoryAction === "suspend" ? "suspended" : "active" } : entry));
    });
  };

  if (!items.length) {
    return <div className="rounded-3xl border border-dashed border-slate-700/70 bg-black/20 p-6 text-sm text-muted-foreground">No Product Knowledge memory rules yet. Correcting safe reusable fields such as material cleanup, supplier cleanup, or category mapping will create reviewable memory here.</div>;
  }

  return (
    <div className="space-y-3">
      {items.map((memory) => (
        <article key={memory.id} className="faust-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge value={memory.status || "active"} tone={memory.status === "suspended" ? "warning" : "success"} />
                <p className="text-sm text-muted-foreground">{memory.memoryType.replaceAll("_", " ")} · {memory.scope}</p>
              </div>
              <h2 className="mt-2 text-lg font-semibold">{memory.pattern} → {memory.output}</h2>
              <p className="mt-1 text-sm text-muted-foreground">Used {memory.usageCount} time(s) · confirmed {memory.successfulApplications || 0} · overridden {memory.overriddenApplications || 0} · rejected {memory.rejectedApplications || 0}</p>
            </div>
            <div className="flex gap-2">
              {memory.status === "suspended"
                ? <button className="rounded-full border border-slate-700/70 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-[var(--color-accent)] disabled:opacity-50" disabled={pending} onClick={() => act(memory, "restore")}>Restore</button>
                : <button className="rounded-full border border-slate-700/70 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-[var(--color-accent)] disabled:opacity-50" disabled={pending} onClick={() => act(memory, "suspend")}>Suspend</button>}
              <button className="rounded-full border border-slate-700/70 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-[var(--color-accent)] disabled:opacity-50" disabled={pending} onClick={() => act(memory, "delete")}>Delete</button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
