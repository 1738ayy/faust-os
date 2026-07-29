"use client";

import { useState, useTransition } from "react";
import type { OperatingData } from "@/domain/business";
import { PrimaryButton, SecondaryButton } from "@/components/faust/design-system";

export function IntelligenceStudioControls({ productId }: { productId?: string }) {
  const [message, setMessage] = useState("Ready.");
  const [pending, startTransition] = useTransition();

  const run = (action: string, payload: Record<string, unknown> = {}) => {
    startTransition(async () => {
      setMessage("Working...");
      const response = await fetch("/api/intelligence/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload }) });
      const body = await response.json() as { ok: boolean; message?: string; data?: OperatingData; actionResult?: { accuracy?: number; deterministic?: boolean; ready?: boolean; sections?: unknown[] } };
      if (!response.ok || body.ok === false) { setMessage(body.message || "Intelligence action failed."); return; }
      if (action === "run-benchmark") setMessage(`Benchmark saved. Accuracy ${body.actionResult?.accuracy ?? 0}%.`);
      else if (action === "replay-product") setMessage(`Replay saved. Deterministic: ${body.actionResult?.deterministic ? "yes" : "review changes"}.`);
      else if (action === "repository-parity") setMessage(`Repository parity ${body.actionResult?.ready ? "ready" : "needs review"}.`);
      else setMessage(`Diagnostics exported with ${body.actionResult?.sections?.length || 0} section(s).`);
    });
  };

  return (
    <section aria-label="Intelligence Studio actions" className="faust-surface p-5">
      <div className="flex flex-wrap gap-3">
        <button disabled={pending} onClick={() => run("run-benchmark", { suite: "product_knowledge", versionLabel: "E.26" })} className="faust-action px-4 py-2 text-sm disabled:opacity-50">Run benchmark</button>
        <button disabled={pending || !productId} onClick={() => run("replay-product", { productId, versionLabel: "E.26" })} className="faust-secondary-action px-4 py-2 text-sm disabled:opacity-50">Replay product</button>
        <button disabled={pending} onClick={() => run("repository-parity")} className="faust-secondary-action px-4 py-2 text-sm disabled:opacity-50">Check repository parity</button>
        <button disabled={pending} onClick={() => run("export-diagnostics", { productId })} className="faust-secondary-action px-4 py-2 text-sm disabled:opacity-50">Export diagnostics</button>
        <PrimaryButton href="/settings/product-knowledge">Memory rules</PrimaryButton>
        <SecondaryButton href="/settings/marketplaces">Marketplace diagnostics</SecondaryButton>
      </div>
      <p role="status" className="mt-4 text-sm text-muted-foreground">{message}</p>
    </section>
  );
}
