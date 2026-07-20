"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OperationButton({ action, id, status, children, className = "" }: { action: "reset" | "transition-order" | "receive-parcel"; id?: string; status?: string; children: React.ReactNode; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function run() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/operating-system", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id, status }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Operation failed.");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Operation failed.");
    } finally {
      setBusy(false);
    }
  }

  return <span className="inline-flex flex-col items-end gap-1"><button onClick={run} disabled={busy} className={`rounded-full border border-slate-700/60 bg-zinc-950/60 px-3 py-1.5 text-xs font-medium transition hover:border-slate-400/60 hover:text-[#edf3ff] disabled:opacity-50 ${className}`}>{busy ? "Working..." : children}</button>{error && <span className="text-xs text-[#d8e0f2]">{error}</span>}</span>;
}
