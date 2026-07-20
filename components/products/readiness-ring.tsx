import { readinessLabel, readinessTone, type ProductReadiness } from "@/lib/product-readiness";

const toneClasses = {
  red: "from-[#465170] to-slate-950 text-[#f6f8ff] shadow-slate-950/40",
  orange: "from-orange-500 to-slate-800 text-orange-50 shadow-orange-950/30",
  yellow: "from-yellow-300 to-orange-600 text-yellow-50 shadow-yellow-950/25",
  green: "from-emerald-300 to-[#56627f] text-emerald-50 shadow-emerald-950/25",
  blue: "from-[#8f9bb8] to-[#56627f] text-[#f6f8ff] shadow-slate-950/25",
};

export function ReadinessRing({ readiness, size = "md" }: { readiness: ProductReadiness; size?: "sm" | "md" | "lg" }) {
  const tone = readinessTone(readiness.status);
  const sizeClasses = size === "lg" ? "h-32 w-32 text-3xl" : size === "sm" ? "h-16 w-16 text-base" : "h-24 w-24 text-2xl";
  const inner = size === "lg" ? "h-24 w-24" : size === "sm" ? "h-12 w-12" : "h-20 w-20";

  return (
    <div className={`relative grid ${sizeClasses} place-items-center rounded-full bg-gradient-to-br ${toneClasses[tone]} shadow-2xl motion-safe:animate-[pulse_4s_ease-in-out_infinite]`} aria-label={`${readinessLabel(readiness.status)} · ${readiness.score}% ready`}>
      <div className={`${inner} grid place-items-center rounded-full border border-white/10 bg-zinc-950/88 text-center backdrop-blur`}>
        <span className="font-heading font-semibold tabular-nums">{readiness.score}</span>
        <span className="-mt-1 text-[0.55rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">ready</span>
      </div>
    </div>
  );
}
