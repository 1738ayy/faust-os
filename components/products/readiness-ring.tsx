"use client";

import { Check, CircleAlert, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { ProductReadiness } from "@/lib/product-readiness";

type ReadinessOrbProps = {
  readiness: ProductReadiness;
  size?: "sm" | "md" | "lg";
  recommendation?: string;
  confidence?: number;
};

const categoryAliases: Record<string, string> = {
  photos: "Photos",
  pricing: "Pricing",
  supplier: "Supplier",
  inventory: "Inventory",
  marketplace_category: "Marketplace",
  seo: "SEO",
  description: "Details",
  shipping_profile: "Shipping",
  cost_validation: "Cost",
  margin_validation: "Margin",
  marketplace_compliance: "Compliance",
};

function readinessState(score: number) {
  if (score >= 90) return { label: "Excellent", color: "#6ee7b7", glow: "rgba(110,231,183,.26)", text: "text-emerald-100" };
  if (score >= 70) return { label: "Ready", color: "#8f9bb8", glow: "rgba(143,155,184,.30)", text: "text-[#edf3ff]" };
  if (score >= 40) return { label: "Needs Work", color: "#f0b35f", glow: "rgba(240,179,95,.24)", text: "text-amber-100" };
  return { label: "Blocked", color: "#fb7185", glow: "rgba(251,113,133,.24)", text: "text-rose-100" };
}

function sizeConfig(size: NonNullable<ReadinessOrbProps["size"]>) {
  if (size === "lg") return { wrap: "h-32 w-32", svg: 128, center: "h-[5.7rem] w-[5.7rem]", score: "text-3xl", label: "text-[0.58rem]", markers: true };
  if (size === "sm") return { wrap: "h-20 w-20", svg: 80, center: "h-14 w-14", score: "text-lg", label: "text-[0.48rem]", markers: false };
  return { wrap: "h-24 w-24", svg: 96, center: "h-[4.3rem] w-[4.3rem]", score: "text-2xl", label: "text-[0.52rem]", markers: true };
}

export function ReadinessRing({ readiness, size = "md", recommendation, confidence }: ReadinessOrbProps) {
  const [open, setOpen] = useState(false);
  const state = readinessState(readiness.score);
  const config = sizeConfig(size);
  const radius = config.svg / 2 - 7;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - readiness.score / 100 * circumference;
  const completed = readiness.dimensions.filter((dimension) => dimension.ready);
  const missing = readiness.dimensions.filter((dimension) => !dimension.ready);
  const topMissing = missing.slice(0, 4);
  const forecast = useMemo(() => {
    const currentReady = completed.length;
    const total = Math.max(1, readiness.dimensions.length);
    return topMissing.map((dimension, index) => ({
      ...dimension,
      impact: Math.max(3, Math.round((1 / total) * 100) - index),
      projected: Math.min(100, Math.round((currentReady + 1) / total * 100)),
    }));
  }, [completed.length, readiness.dimensions.length, topMissing]);
  const next = topMissing[0];
  const panelId = `readiness-panel-${readiness.status}-${readiness.score}`;

  return (
    <div className="group/readiness relative inline-flex">
      <button
        type="button"
        aria-label={`${state.label}. ${readiness.score}% ready. ${readiness.nextAction}.`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
        className={`relative grid ${config.wrap} place-items-center rounded-full outline-none transition duration-300 focus-visible:ring-4 focus-visible:ring-[#8f9bb8]/35 motion-safe:hover:scale-[1.025]`}
        style={{ filter: `drop-shadow(0 0 22px ${state.glow})` }}
      >
        <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,.16),rgba(15,23,42,.78)_42%,rgba(0,0,0,.92)_75%)] shadow-2xl shadow-black/40" />
        <svg className="absolute inset-0 -rotate-90 overflow-visible" width={config.svg} height={config.svg} viewBox={`0 0 ${config.svg} ${config.svg}`} aria-hidden="true">
          <circle cx={config.svg / 2} cy={config.svg / 2} r={radius} fill="none" stroke="rgba(148,163,184,.18)" strokeWidth="2" />
          <circle
            cx={config.svg / 2}
            cy={config.svg / 2}
            r={radius}
            fill="none"
            stroke={state.color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset,stroke] duration-700 motion-reduce:transition-none"
          />
          <circle cx={config.svg / 2} cy="7" r="2" fill={state.color} className="opacity-80 motion-safe:animate-pulse motion-reduce:animate-none" />
        </svg>
        {config.markers ? (
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            {readiness.dimensions.slice(0, 6).map((dimension, index) => {
              const angle = -90 + index * 60;
              const markerRadius = config.svg / 2 - 1;
              const x = Math.cos(angle * Math.PI / 180) * markerRadius;
              const y = Math.sin(angle * Math.PI / 180) * markerRadius;
              return (
                <span
                  key={dimension.key}
                  className={`absolute left-1/2 top-1/2 grid h-3 w-3 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border text-[7px] ${dimension.ready ? "border-[#8f9bb8]/70 bg-[#8f9bb8]/40 text-white" : "border-slate-600/70 bg-black/70 text-slate-400"}`}
                  style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
                >
                  {dimension.ready ? "✓" : "•"}
                </span>
              );
            })}
          </div>
        ) : null}
        <span className={`${config.center} relative grid place-items-center rounded-full border border-white/10 bg-zinc-950/88 text-center shadow-inner shadow-black/60 backdrop-blur`}>
          <span className={`font-heading ${config.score} font-semibold tabular-nums ${state.text}`}>{readiness.score}</span>
          <span className={`-mt-2 font-medium uppercase tracking-[0.16em] text-muted-foreground ${config.label}`}>{state.label}</span>
        </span>
      </button>

      <div className="pointer-events-none absolute right-0 top-full z-40 mt-3 hidden w-80 rounded-[1.6rem] border border-slate-700/50 bg-[#070a0f]/95 p-4 text-left shadow-2xl shadow-black/60 backdrop-blur-xl group-hover/readiness:block group-focus-within/readiness:block">
        <ReadinessPanelContent readiness={readiness} stateLabel={state.label} next={next} forecast={forecast} recommendation={recommendation} confidence={confidence} compact />
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <section
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-label="Product readiness workspace"
            className="w-full max-w-lg rounded-[2rem] border border-slate-700/55 bg-[#070a0f] p-5 shadow-2xl shadow-black/70"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8f9bb8]">Product health</p>
                <h2 className="mt-2 text-2xl font-semibold">Readiness Workspace</h2>
              </div>
              <button type="button" aria-label="Close readiness workspace" onClick={() => setOpen(false)} className="rounded-full border border-slate-700/60 p-2 text-[#f6f8ff] transition hover:border-[#8f9bb8]/70">
                <X size={18} />
              </button>
            </div>
            <ReadinessPanelContent readiness={readiness} stateLabel={state.label} next={next} forecast={forecast} recommendation={recommendation} confidence={confidence} />
          </section>
        </div>
      ) : null}
    </div>
  );
}

function ReadinessPanelContent({ readiness, stateLabel, next, forecast, recommendation, confidence, compact = false }: { readiness: ProductReadiness; stateLabel: string; next?: ProductReadiness["dimensions"][number]; forecast: (ProductReadiness["dimensions"][number] & { impact: number; projected: number })[]; recommendation?: string; confidence?: number; compact?: boolean }) {
  return (
    <div className={compact ? "" : "mt-5"}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Readiness</p>
          <p className="mt-1 font-heading text-4xl font-semibold tabular-nums text-[#f6f8ff]">{readiness.score}%</p>
        </div>
        <span className="rounded-full border border-slate-700/50 bg-slate-800/20 px-3 py-1 text-xs font-semibold text-[#edf3ff]">{stateLabel}</span>
      </div>
      <div className="mt-4 space-y-2">
        {readiness.dimensions.slice(0, compact ? 7 : readiness.dimensions.length).map((dimension) => (
          <div key={dimension.key} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-700/35 bg-black/35 p-3">
            <div className="flex items-start gap-2">
              {dimension.ready ? <Check className="mt-0.5 h-4 w-4 text-[#8f9bb8]" /> : <CircleAlert className="mt-0.5 h-4 w-4 text-amber-200" />}
              <div>
                <p className="text-sm font-medium">{categoryAliases[dimension.key] || dimension.label}</p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{dimension.detail}</p>
              </div>
            </div>
            <span className="text-xs text-muted-foreground">{dimension.ready ? "Done" : "Missing"}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-2xl border border-[#8f9bb8]/30 bg-[#8f9bb8]/10 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#f6f8ff]"><Sparkles className="h-4 w-4 text-[#8f9bb8]" />Faust recommendation</div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{recommendation || readiness.nextAction}</p>
        {next ? <p className="mt-2 text-xs text-[#edf3ff]">{next.label} could add roughly +{forecast[0]?.impact || 0}% and move readiness toward {forecast[0]?.projected || readiness.score}%.</p> : <p className="mt-2 text-xs text-[#edf3ff]">This product is ready for marketplace execution.</p>}
        {confidence !== undefined ? <p className="mt-2 text-xs text-muted-foreground">{Math.round(confidence * 100)}% recommendation confidence</p> : null}
      </div>
      {!compact && forecast.length ? (
        <div className="mt-4">
          <p className="text-sm font-semibold">Progress forecast</p>
          <div className="mt-2 grid gap-2">
            {forecast.map((item) => <div key={item.key} className="flex justify-between rounded-2xl border border-slate-700/35 bg-black/30 px-3 py-2 text-sm"><span>{item.label}</span><span className="text-[#edf3ff]">+{item.impact}%</span></div>)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
