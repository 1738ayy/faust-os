"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Field = { name: string; label: string; type?: "text" | "number" | "date"; required?: boolean };

export function RecordForm({ endpoint, submitLabel, fields }: { endpoint: string; submitLabel: string; fields: Field[] }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not save record.");
      setValues({});
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save record.");
    } finally {
      setSaving(false);
    }
  }

  return <form onSubmit={submit} className="rounded-3xl border border-red-950/45 bg-zinc-950/55 p-5 shadow-lg shadow-black/20 backdrop-blur"><div className="grid gap-3 sm:grid-cols-2">{fields.map((field) => <label key={field.name} className="text-sm font-medium">{field.label}<input required={field.required} type={field.type || "text"} value={values[field.name] || ""} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} className="faust-field faust-focus mt-2 w-full px-3 py-2 font-normal" /></label>)}</div>{error && <p className="mt-3 text-sm text-red-400">{error}</p>}<button disabled={saving} className="mt-5 rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-lg shadow-red-950/30 transition hover:bg-red-500 disabled:opacity-60">{saving ? "Saving…" : submitLabel}</button></form>;
}
