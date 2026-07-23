"use client";

import { useEffect, useMemo, useState } from "react";

type Metric = { label: string; value: number; unit: string };

function round(value: number) {
  return Math.max(0, Math.round(value));
}

function readNavigationMetrics(): Metric[] {
  const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (!navigation) return [];
  return [
    { label: "TTFB", value: round(navigation.responseStart - navigation.requestStart), unit: "ms" },
    { label: "DOM", value: round(navigation.domContentLoadedEventEnd - navigation.startTime), unit: "ms" },
    { label: "Load", value: round(navigation.loadEventEnd - navigation.startTime), unit: "ms" },
    { label: "Hydration window", value: round(navigation.domInteractive - navigation.responseEnd), unit: "ms" },
  ];
}

function readResourceMetrics(): Metric[] {
  const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
  const api = resources.filter((entry) => entry.name.includes("/api/"));
  const images = resources.filter((entry) => /\.(png|jpe?g|webp|svg)(\?|$)/i.test(entry.name) || entry.initiatorType === "img");
  const scripts = resources.filter((entry) => entry.initiatorType === "script");
  const apiTotal = api.reduce((sum, entry) => sum + entry.duration, 0);
  const imageTotal = images.reduce((sum, entry) => sum + entry.duration, 0);
  const scriptTotal = scripts.reduce((sum, entry) => sum + entry.duration, 0);
  return [
    { label: "API", value: round(apiTotal), unit: "ms" },
    { label: "Images", value: round(imageTotal), unit: "ms" },
    { label: "Scripts", value: round(scriptTotal), unit: "ms" },
    { label: "Requests", value: resources.length, unit: "" },
  ];
}

export function PerformanceOverlay() {
  const [open, setOpen] = useState(false);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [route, setRoute] = useState("");

  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      if (!mounted) return;
      setRoute(window.location.pathname);
      setMetrics([...readNavigationMetrics(), ...readResourceMetrics()]);
    };
    const timeout = window.setTimeout(refresh, 250);
    const observer = typeof PerformanceObserver !== "undefined" ? new PerformanceObserver(refresh) : undefined;
    observer?.observe({ entryTypes: ["resource"] });
    window.addEventListener("load", refresh);
    return () => {
      mounted = false;
      window.clearTimeout(timeout);
      window.removeEventListener("load", refresh);
      observer?.disconnect();
    };
  }, []);

  const slowest = useMemo(() => [...metrics].sort((a, b) => b.value - a.value).slice(0, 6), [metrics]);

  return (
    <aside className="fixed bottom-3 right-3 z-[80] max-w-[calc(100vw-1.5rem)] text-xs">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-full border border-slate-700/60 bg-zinc-950/90 px-3 py-2 font-semibold text-[#edf3ff] shadow-2xl shadow-black/35 backdrop-blur transition hover:border-slate-400/60"
      >
        Perf
      </button>
      {open ? (
        <section className="mt-2 w-80 rounded-3xl border border-slate-700/60 bg-zinc-950/95 p-4 text-[#edf3ff] shadow-2xl shadow-black/45 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold">Development performance</p>
              <p className="mt-1 truncate text-[11px] text-muted-foreground">{route || "current route"}</p>
            </div>
            <button type="button" onClick={() => setMetrics([...readNavigationMetrics(), ...readResourceMetrics()])} className="rounded-full border border-slate-700/60 px-2 py-1 text-[11px] text-muted-foreground transition hover:text-[#edf3ff]">Refresh</button>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {slowest.map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-slate-700/35 bg-black/35 p-3">
                <p className="text-[11px] text-muted-foreground">{metric.label}</p>
                <p className="mt-1 font-heading text-lg font-semibold tabular-nums">{metric.value}{metric.unit}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-5 text-muted-foreground">Dev-only overlay. Use this to separate network, image, script, and load costs before optimizing.</p>
        </section>
      ) : null}
    </aside>
  );
}

