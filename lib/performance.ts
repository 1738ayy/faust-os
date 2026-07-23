export type PerformanceMark = { label: string; durationMs: number };

export function createPerformanceTimer() {
  const startedAt = performance.now();
  const marks: PerformanceMark[] = [];
  let lastMark = startedAt;

  return {
    mark(label: string) {
      const now = performance.now();
      marks.push({ label, durationMs: Math.round((now - lastMark) * 10) / 10 });
      lastMark = now;
    },
    finish(label = "total") {
      const total = Math.round((performance.now() - startedAt) * 10) / 10;
      return { label, totalMs: total, marks };
    },
  };
}

export function serverTimingHeader(marks: PerformanceMark[]) {
  return marks
    .filter((mark) => Number.isFinite(mark.durationMs) && mark.durationMs >= 0)
    .map((mark) => `${mark.label.replace(/[^a-z0-9_-]/gi, "_")};dur=${mark.durationMs}`)
    .join(", ");
}

