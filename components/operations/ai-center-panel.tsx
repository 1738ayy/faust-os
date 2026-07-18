"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, CheckCircle2, FileText, Send, Sparkles } from "lucide-react";
import type { AiProviderKey, OperatingData } from "@/domain/business";

const prompts = [
  "What should I reorder today?",
  "Which SKUs are tying up cash?",
  "Why did margin fall this month?",
  "Which channel is most profitable?",
  "Which supplier is becoming unreliable?",
  "Which listings should I pause or delist?",
  "How much deployable cash can I safely use?",
  "Which shipments need attention?",
  "Which automations are failing?",
];

function firstRecommendationId(data: OperatingData) {
  return (data.aiRecommendations || [])[0]?.id || "";
}

function providerLabel(provider: AiProviderKey) {
  return provider === "openai" ? "OpenAI grounded mode" : "Deterministic grounded mode";
}

export function AiCenterPanel({ data, provider }: { data: OperatingData; provider: AiProviderKey }) {
  const router = useRouter();
  const [question, setQuestion] = useState("What should I reorder today?");
  const [status, setStatus] = useState("Ready. Faust will answer only from saved business records.");
  const [latestAnswer, setLatestAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const variantId = data.variants[0]?.id;
  const latestRecommendationId = useMemo(() => firstRecommendationId(data), [data]);

  async function run(payload: Record<string, unknown>, success: string) {
    setBusy(true);
    setStatus("Reading Faust records...");
    try {
      const response = await fetch("/api/ai-center/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "AI Center action failed.");
      const content = typeof body.actionResult?.message?.content === "string" ? body.actionResult.message.content : "";
      if (content) setLatestAnswer(content);
      setStatus(success);
      router.refresh();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "AI Center action failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="AI Center actions" className="overflow-hidden rounded-3xl border border-red-950/45 bg-zinc-950/60 shadow-xl shadow-black/20 backdrop-blur">
      <div className="grid gap-5 border-b border-red-950/45 p-5 lg:grid-cols-[1fr_280px]">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-red-300">
            <Bot size={15} />
            Ask Faust
          </div>
          <h2 className="mt-3 text-2xl font-semibold">Ask an operating question, get an evidence-backed answer.</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Faust checks inventory, orders, finance, purchasing, listings, fulfillment, analytics, and automations before answering. Risky actions become approval requests instead of silent mutations.
          </p>
        </div>
        <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-red-300">Provider</p>
          <p className="mt-2 font-medium">{providerLabel(provider)}</p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {provider === "openai" ? "OpenAI rewrites grounded Faust evidence when configured." : "No-provider mode uses deterministic Faust rules only."}
          </p>
        </div>
      </div>

      <div className="p-5">
        <label className="block text-sm font-medium">
          Question
          <textarea
            className="mt-2 min-h-24 w-full resize-none rounded-2xl border border-red-950/45 bg-black/35 px-4 py-3 text-sm font-normal leading-6 transition focus:border-red-500/60"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          <button disabled={busy || !question.trim()} className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-red-950/30 transition hover:bg-red-500 disabled:opacity-50" onClick={() => run({ action: "ask-question", question, saveQuestion: true, provider }, "Grounded answer saved and shown below.")}>
            <Send size={15} />
            Ask question
          </button>
          <button disabled={busy} className="inline-flex items-center gap-2 rounded-full border border-red-950/60 bg-zinc-950/50 px-4 py-2 text-sm transition hover:border-red-500/50 disabled:opacity-50" onClick={() => run({ action: "daily-brief", provider }, "Daily brief generated from current Faust records.")}>
            <FileText size={15} />
            Generate daily brief
          </button>
          <button disabled={busy || !variantId} className="inline-flex items-center gap-2 rounded-full border border-red-950/60 bg-zinc-950/50 px-4 py-2 text-sm transition hover:border-red-500/50 disabled:opacity-50" onClick={() => run({ action: "run-scenario", name: "Buy 300 units", prompt: "What happens if I buy 300 units of this SKU?", units: 300, variantId, priceChangePercent: 8, reserveCash: 150 }, "300-unit scenario created.")}>
            <Sparkles size={15} />
            300-unit scenario
          </button>
          <button disabled={busy || !latestRecommendationId} className="rounded-full border border-red-950/60 bg-zinc-950/50 px-4 py-2 text-sm transition hover:border-red-500/50 disabled:opacity-50" onClick={() => run({ action: "save-recommendation", recommendationId: latestRecommendationId }, "Top recommendation saved.")}>Save top recommendation</button>
          <button disabled={busy || !latestRecommendationId} className="rounded-full border border-red-950/60 bg-zinc-950/50 px-4 py-2 text-sm transition hover:border-red-500/50 disabled:opacity-50" onClick={() => run({ action: "request-approval", recommendationId: latestRecommendationId, reason: "Owner approval required before AI-suggested operating action." }, "Approval request created.")}>Send for approval</button>
        </div>

        <div role="status" className="mt-4 flex items-center gap-2 rounded-2xl border border-red-950/45 bg-black/35 px-4 py-3 text-sm text-red-300">
          <CheckCircle2 size={15} />
          {status}
        </div>

        {latestAnswer && (
          <div className="mt-4 rounded-2xl border border-red-950/45 bg-black/35 p-4 text-sm">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-red-300">Latest answer</p>
            <p className="whitespace-pre-wrap leading-6 text-muted-foreground">{latestAnswer}</p>
          </div>
        )}

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Try asking</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {prompts.map((prompt) => (
              <button key={prompt} className="rounded-full border border-red-950/50 bg-zinc-950/40 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-red-500/60 hover:text-red-200" onClick={() => setQuestion(prompt)}>
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
