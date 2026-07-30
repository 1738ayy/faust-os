const secretPattern = /(api[_-]?key|secret|token|password|service[_-]?role|authorization)/i;

export function correlationId(prefix = "faust") {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function redactOperationalContext(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactOperationalContext);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, secretPattern.test(key) ? "[redacted]" : redactOperationalContext(entry)]));
}

export function productionErrorPayload(error: unknown, context: Record<string, unknown> = {}) {
  const id = correlationId("err");
  return {
    ok: false,
    correlationId: id,
    message: error instanceof Error ? error.message : "Operation failed.",
    context: redactOperationalContext(context),
  };
}
