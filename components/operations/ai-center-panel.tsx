"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AiProviderKey, OperatingData } from "@/domain/business";

function firstRecommendationId(data: OperatingData) {
  return (data.aiRecommendations || [])[0]?.id || "";
}

export function AiCenterPanel({ data, provider }: { data: OperatingData; provider: AiProviderKey }) {
  const router = useRouter();
  const [question, setQuestion] = useState("What should I reorder today?");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const variantId = data.variants[0]?.id;
  const latestRecommendationId = useMemo(() => firstRecommendationId(data), [data]);
  async function run(payload: Record<string, unknown>, success: string) {
    setBusy(true); setStatus("Working...");
    try {
      const response = await fetch("/api/ai-center/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "AI Center action failed.");
      setStatus(success);
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "AI Center action failed.");
    } finally {
      setBusy(false);
    }
  }
  return <section aria-label="AI Center actions" className="border border-border bg-card p-5">
    <div className="flex flex-wrap items-end gap-3">
      <label className="min-w-[280px] flex-1 text-sm"><span className="mb-2 block text-xs uppercase text-muted-foreground">Ask Faust</span><input className="w-full border border-border bg-background px-3 py-2" value={question} onChange={(event) => setQuestion(event.target.value)} /></label>
      <button disabled={busy} className="border border-emerald-500 px-4 py-2 text-sm text-emerald-300 disabled:opacity-50" onClick={() => run({ action: "ask-question", question, saveQuestion: true, provider }, "Grounded answer saved.")}>Ask question</button>
      <button disabled={busy} className="border border-border px-4 py-2 text-sm" onClick={() => run({ action: "daily-brief", provider }, "Daily brief generated.")}>Generate daily brief</button>
      <button disabled={busy || !variantId} className="border border-border px-4 py-2 text-sm disabled:opacity-50" onClick={() => run({ action: "run-scenario", name: "Buy 300 units", prompt: "What happens if I buy 300 units of this SKU?", units: 300, variantId, priceChangePercent: 8, reserveCash: 150 }, "Scenario created.")}>Run 300-unit scenario</button>
      <button disabled={busy || !latestRecommendationId} className="border border-border px-4 py-2 text-sm disabled:opacity-50" onClick={() => run({ action: "save-recommendation", recommendationId: latestRecommendationId }, "Recommendation saved.")}>Save top recommendation</button>
      <button disabled={busy || !latestRecommendationId} className="border border-border px-4 py-2 text-sm disabled:opacity-50" onClick={() => run({ action: "request-approval", recommendationId: latestRecommendationId, reason: "Owner approval required before AI-suggested operating action." }, "Approval request created.")}>Send for approval</button>
    </div>
    <div role="status" className="mt-3 text-sm text-emerald-300">{status}</div>
    <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
      {["Which SKUs are tying up cash?", "Why did margin fall this month?", "Which channel is most profitable?", "Which supplier is becoming unreliable?", "Which shipments need attention?", "Which automations are failing?"].map((prompt) => <button key={prompt} className="border border-border px-3 py-1" onClick={() => setQuestion(prompt)}>{prompt}</button>)}
    </div>
  </section>;
}
