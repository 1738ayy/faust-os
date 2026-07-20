import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

import { StatusBadge } from "@/components/faust/design-system";

export type FaustRecommendation = {
  title: string;
  recommendation: string;
  evidence: string;
  metrics?: string[];
  confidence: number;
  missingData?: string[];
  actionLabel: string;
  href: string;
};

export function AiRecommendationPanel({ eyebrow = "Faust recommendation", item }: { eyebrow?: string; item: FaustRecommendation }) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-slate-700/45 bg-zinc-950/55 p-5 shadow-lg shadow-black/20 backdrop-blur">
      <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-[#56627f]/10 blur-3xl" />
      <div className="relative">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#c8d2e6]">{eyebrow}</p>
            <h2 className="mt-2 text-lg font-semibold">{item.title}</h2>
          </div>
          <Sparkles className="h-5 w-5 text-[#c8d2e6]" />
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.recommendation}</p>
        <div className="mt-4 rounded-2xl border border-slate-700/35 bg-black/35 p-4">
          <p className="text-xs font-medium text-muted-foreground">Evidence</p>
          <p className="mt-1 text-sm">{item.evidence}</p>
          {item.metrics?.length ? <div className="mt-3 flex flex-wrap gap-2">{item.metrics.map((metric) => <span className="rounded-full border border-slate-700/45 bg-zinc-950/70 px-2.5 py-1 text-xs text-muted-foreground" key={metric}>{metric}</span>)}</div> : null}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <StatusBadge value={`${Math.round(item.confidence * 100)}% confidence`} tone={item.confidence >= 0.7 ? "success" : item.confidence >= 0.45 ? "warning" : "danger"} />
          {item.missingData?.length ? <p className="text-xs text-muted-foreground">Missing: {item.missingData.join(", ")}</p> : <p className="text-xs text-muted-foreground">Grounded in Faust records</p>}
          <Link href={item.href} className="inline-flex items-center gap-1 text-xs font-semibold text-[#c8d2e6] hover:text-[#edf3ff]">{item.actionLabel}<ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
      </div>
    </section>
  );
}
