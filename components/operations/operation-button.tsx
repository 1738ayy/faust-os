"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OperationButton({ action, id, status, mode, children, className = "" }: { action: "reset" | "transition-order" | "receive-parcel"; id?: string; status?: string; mode?: "empty" | "development_demo"; children: React.ReactNode; className?: string }) {
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
        body: JSON.stringify({ action, id, status, mode }),
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

  return <span className="inline-flex flex-col items-end gap-1"><button onClick={run} disabled={busy} className={`rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium transition hover:border-emerald-400 hover:text-emerald-300 disabled:opacity-50 ${className}`}>{busy ? "Working..." : children}</button>{error && <span className="text-xs text-red-400">{error}</span>}</span>;
}
