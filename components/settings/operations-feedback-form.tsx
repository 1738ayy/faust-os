"use client";

import { useState, type FormEvent } from "react";

const fieldClass = "faust-field faust-focus w-full px-3 py-2 text-sm text-[#f6f8ff] placeholder:text-muted-foreground";

export function OperationsFeedbackForm() {
  const [message, setMessage] = useState("Ready to log daily dogfooding friction.");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setMessage("Recording feedback...");
    const response = await fetch("/api/operations/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: form.get("type"),
        severity: form.get("severity"),
        workflow: form.get("workflow"),
        title: form.get("title"),
        expectedAction: form.get("expectedAction") || undefined,
        actualAction: form.get("actualAction") || undefined,
        timeLostMinutes: form.get("timeLostMinutes") || undefined,
        proposedImprovement: form.get("proposedImprovement") || undefined,
        source: "dogfooding",
      }),
    });
    const result = await response.json().catch(() => ({}));
    setPending(false);
    if (!response.ok || !result.ok) {
      setMessage(result.message || "Feedback could not be recorded.");
      return;
    }
    event.currentTarget.reset();
    setMessage("Feedback recorded and routed into System Health.");
  }

  return (
    <form className="grid gap-3" onSubmit={submit}>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Type</span>
          <select className={fieldClass} name="type" defaultValue="workflow_friction">
            <option value="workflow_friction">Workflow friction</option>
            <option value="bug">Bug</option>
            <option value="feature_request">Improvement</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Severity</span>
          <select className={fieldClass} name="severity" defaultValue="medium">
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Workflow</span>
          <input className={fieldClass} name="workflow" placeholder="Import → Review → Publish" required />
        </label>
      </div>
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">What happened?</span>
        <input className={fieldClass} name="title" placeholder="Example: bulk approve lost selection after reload" required />
      </label>
      <div className="grid gap-3 md:grid-cols-2">
        <textarea className={`${fieldClass} min-h-24`} name="expectedAction" placeholder="Expected behavior" />
        <textarea className={`${fieldClass} min-h-24`} name="actualAction" placeholder="Actual behavior" />
      </div>
      <div className="grid gap-3 md:grid-cols-[160px_1fr]">
        <input className={fieldClass} name="timeLostMinutes" type="number" min="0" placeholder="Minutes lost" />
        <input className={fieldClass} name="proposedImprovement" placeholder="Suggested fix or better workflow" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" role="status">{message}</p>
        <button className="faust-action" disabled={pending}>{pending ? "Recording..." : "Record feedback"}</button>
      </div>
    </form>
  );
}
