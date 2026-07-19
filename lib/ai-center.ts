import type { AiApprovalProposal, AiConversation, AiDailyBrief, AiEvidenceLink, AiFeedback, AiMessage, AiObservabilityEvent, AiProviderKey, AiRecommendation, AiSavedQuestion, AiScenario, AiToolCall, AutomationApproval, OperatingData, Variant } from "../domain/business";
import { availableUnits, money, orderProfit, reorderSuggestion } from "./business-calculations";
import { buildAnalyticsModel } from "./analytics";
import { buildFinanceModel } from "./finance";

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export type AiCenterActionInput =
  | { action: "ask-question"; question: string; conversationId?: string; saveQuestion?: boolean; provider?: AiProviderKey }
  | { action: "daily-brief"; provider?: AiProviderKey }
  | { action: "run-scenario"; name?: string; prompt: string; units?: number; variantId?: string; priceChangePercent?: number; supplierId?: string; marketingBudgetChange?: number; reserveCash?: number }
  | { action: "save-recommendation"; recommendationId: string }
  | { action: "request-approval"; recommendationId: string; reason?: string }
  | { action: "feedback"; messageId?: string; recommendationId?: string; rating: AiFeedback["rating"]; comment?: string };

export type AiCenterMutationResult = { data: OperatingData; actionResult: unknown };

export type AiProviderAdapter = {
  key: AiProviderKey;
  label: string;
  configured: boolean;
  answer: (input: { question: string; deterministicAnswer: string; evidence: AiEvidenceLink[] }) => Promise<{ content: string; mode: "deterministic" | "model_generated"; model?: string; tokenUsage?: { input: number; output: number }; estimatedCostUsd?: number }>;
};

function configuredOpenAiModel() {
  return process.env.OPENAI_MODEL || "gpt-5";
}

function readResponsesText(body: unknown) {
  if (typeof body !== "object" || !body) return "";
  const record = body as Record<string, unknown>;
  if (typeof record.output_text === "string" && record.output_text.trim()) return record.output_text.trim();
  const texts: string[] = [];
  const visit = (value: unknown, parentKey = "") => {
    if (typeof value === "string") {
      if (["text", "output_text", "content"].includes(parentKey) && value.trim()) texts.push(value.trim());
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => visit(entry, parentKey));
      return;
    }
    if (typeof value === "object" && value) {
      for (const [key, nested] of Object.entries(value as Record<string, unknown>)) visit(nested, key);
    }
  };
  const output = Array.isArray(record.output) ? record.output : [];
  visit(output, "output");
  return texts.join("\n\n").trim();
}

function summarizeResponseShape(body: unknown) {
  if (typeof body !== "object" || !body) return "non-object response";
  const record = body as Record<string, unknown>;
  const output = Array.isArray(record.output) ? record.output : [];
  const outputTypes = output.map((item) => typeof item === "object" && item ? String((item as Record<string, unknown>).type || "unknown") : typeof item).join(", ") || "none";
  const finishReasons = output.map((item) => typeof item === "object" && item ? String((item as Record<string, unknown>).finish_reason || "") : "").filter(Boolean).join(", ") || "none";
  const usage = typeof record.usage === "object" && record.usage ? record.usage as Record<string, unknown> : {};
  return `status=${String(record.status || "unknown")}; output types=${outputTypes}; finish reasons=${finishReasons}; input tokens=${String(usage.input_tokens || 0)}; output tokens=${String(usage.output_tokens || 0)}`;
}

function reasoningForModel(model: string) {
  if (!/^(gpt-5|o\d)/i.test(model)) return undefined;
  if (/^gpt-5\.1/i.test(model)) return { effort: "none" };
  return { effort: "minimal" };
}

function maxOutputTokensForModel(model: string) {
  if (/^gpt-5/i.test(model)) return 1200;
  return 700;
}

function openAiPayload(model: string, input: string) {
  const payload: Record<string, unknown> = {
    model,
    instructions: "You are Faust AI Center. Answer only from the supplied Faust evidence and deterministic operating summary. If evidence is missing, say what Faust does and does not know. Do not claim external facts, do not execute risky actions, and keep the response concise with practical next steps.",
    input,
    max_output_tokens: maxOutputTokensForModel(model),
  };
  const reasoning = reasoningForModel(model);
  if (reasoning) payload.reasoning = reasoning;
  return payload;
}

function openAiFallbackPayload(model: string, deterministicAnswer: string) {
  const fallbackInput = `Rewrite this grounded Faust operating answer in one concise paragraph. Do not add facts:\n${deterministicAnswer}`;
  const payload = openAiPayload(model, fallbackInput);
  if (typeof payload.max_output_tokens === "number") payload.max_output_tokens = Math.max(500, payload.max_output_tokens);
  return payload;
}

async function postOpenAiResponse(apiKey: string, payload: Record<string, unknown>, signal: AbortSignal) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    signal,
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body === "object" && body && "error" in body && typeof (body as { error?: { message?: unknown } }).error?.message === "string" ? (body as { error: { message: string } }).error.message : `OpenAI request failed with status ${response.status}.`;
    throw new Error(message);
  }
  return body;
}

async function askOpenAi(input: { question: string; deterministicAnswer: string; evidence: AiEvidenceLink[] }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OpenAI is selected, but OPENAI_API_KEY is not configured on the server.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  const model = configuredOpenAiModel();
  try {
    const evidence = input.evidence.length ? input.evidence.map((link, index) => `${index + 1}. ${link.label} (${link.sourceType}, ${link.href}): ${link.excerpt}`).join("\n") : "No Faust evidence records were found for this question.";
    let body = await postOpenAiResponse(apiKey, openAiPayload(model, `User question:\n${input.question}\n\nDeterministic Faust answer:\n${input.deterministicAnswer}\n\nFaust evidence records:\n${evidence}`), controller.signal);
    let content = readResponsesText(body);
    if (!content) {
      const firstShape = summarizeResponseShape(body);
      body = await postOpenAiResponse(apiKey, openAiFallbackPayload(model, input.deterministicAnswer), controller.signal);
      content = readResponsesText(body);
      if (!content) throw new Error(`OpenAI returned no answer text (${firstShape}; retry ${summarizeResponseShape(body)}).`);
    }
    const usage = typeof body === "object" && body && "usage" in body ? (body as { usage?: Record<string, unknown> }).usage : undefined;
    const inputTokens = Number(usage?.input_tokens || usage?.prompt_tokens || 0);
    const outputTokens = Number(usage?.output_tokens || usage?.completion_tokens || 0);
    return { content, mode: "model_generated" as const, model, tokenUsage: inputTokens || outputTokens ? { input: inputTokens, output: outputTokens } : undefined, estimatedCostUsd: 0 };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("OpenAI request timed out before Faust received an answer.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export const aiProviderAdapters: Record<AiProviderKey, AiProviderAdapter> = {
  deterministic: { key: "deterministic", label: "Deterministic Faust rules", configured: true, answer: async ({ deterministicAnswer }) => ({ content: deterministicAnswer, mode: "deterministic" }) },
  openai: { key: "openai", label: "OpenAI adapter", configured: Boolean(process.env.OPENAI_API_KEY), answer: askOpenAi },
  anthropic: { key: "anthropic", label: "Anthropic-ready adapter", configured: false, answer: async ({ deterministicAnswer }) => ({ content: `${deterministicAnswer}\n\nProvider note: Anthropic credentials are not connected, so Faust used deterministic grounded mode.`, mode: "deterministic" }) },
  gemini: { key: "gemini", label: "Gemini-ready adapter", configured: false, answer: async ({ deterministicAnswer }) => ({ content: `${deterministicAnswer}\n\nProvider note: Gemini credentials are not connected, so Faust used deterministic grounded mode.`, mode: "deterministic" }) },
};

export function ensureAiCollections(data: OperatingData) {
  data.aiConversations ||= [];
  data.aiMessages ||= [];
  data.aiSavedQuestions ||= seedSavedQuestions();
  data.aiToolCalls ||= [];
  data.aiRecommendations ||= [];
  data.aiEvidenceLinks ||= [];
  data.aiScenarios ||= [];
  data.aiDailyBriefs ||= [];
  data.aiApprovalProposals ||= [];
  data.aiFeedback ||= [];
  data.aiObservabilityEvents ||= [];
}

function seedSavedQuestions(): AiSavedQuestion[] {
  const createdAt = now();
  return [
    ["What should I reorder today?", "purchasing"],
    ["Which SKUs are tying up cash?", "inventory"],
    ["Why did margin fall this month?", "finance"],
    ["Which channel is most profitable?", "analytics"],
    ["Which shipments need attention?", "fulfillment"],
    ["Which automations are failing?", "automations"],
  ].map(([question, category]) => ({ id: id(), question, category: category as AiSavedQuestion["category"], createdAt }));
}

function evidence(data: OperatingData, sourceType: AiEvidenceLink["sourceType"], sourceId: string, label: string, href: string, excerpt: string, confidence = 0.9) {
  ensureAiCollections(data);
  const existing = data.aiEvidenceLinks!.find((entry) => entry.sourceType === sourceType && entry.sourceId === sourceId && entry.label === label);
  if (existing) return existing;
  const link: AiEvidenceLink = { id: id(), sourceType, sourceId, label, href, excerpt, confidence, createdAt: now() };
  data.aiEvidenceLinks!.unshift(link);
  return link;
}

function variantEvidence(data: OperatingData, variant: Variant, excerpt: string) {
  return evidence(data, "inventory", variant.id, variant.sku, "/inventory", excerpt);
}

function addActivity(data: OperatingData, action: string, entityType: string, entityId: string, detail: string) {
  data.activity.unshift({ id: id(), action, entityType, entityId, detail, createdAt: now() });
}

function tool(data: OperatingData, toolName: string, input: Record<string, unknown>, outputSummary: string, evidenceIds: string[], startedAt: number, status: "succeeded" | "failed" = "succeeded", error?: string) {
  ensureAiCollections(data);
  const call: AiToolCall = { id: id(), toolName, input, outputSummary, evidenceIds, status, latencyMs: Math.max(1, Date.now() - startedAt), error, createdAt: now() };
  data.aiToolCalls!.unshift(call);
  return call;
}

export function buildAiOperatingContext(data: OperatingData) {
  ensureAiCollections(data);
  const finance = buildFinanceModel(data);
  const analytics = buildAnalyticsModel(data);
  const reorders = data.variants.map((variant) => {
    const balance = data.balances.find((entry) => entry.variantId === variant.id);
    return { variant, balance, available: balance ? availableUnits(balance) : 0, suggested: reorderSuggestion(balance, variant), inventoryValue: (balance?.onHand || 0) * variant.landedUnitCost };
  }).filter((entry) => entry.suggested > 0 || entry.inventoryValue > 0);
  const shipmentsNeedingAttention = (data.fulfillmentShipments || []).filter((shipment) => ["exception", "awaiting_inventory", "lost", "claim_filed"].includes(shipment.status) || shipment.trackingStatus === "delayed");
  const listingRisks = [...(data.listingReviewItems || []).filter((item) => item.status === "open"), ...(data.inventoryRiskLocks || []).filter((lock) => lock.status === "active")];
  const automationFailures = [...(data.automationRuns || []).filter((run) => ["failed", "dead_lettered"].includes(run.status)), ...(data.automationDeadLetters || []).filter((letter) => letter.status === "open")];
  return { finance, analytics, reorders, shipmentsNeedingAttention, listingRisks, automationFailures };
}

export function generateAiRecommendations(data: OperatingData) {
  ensureAiCollections(data);
  const context = buildAiOperatingContext(data);
  const recommendations: AiRecommendation[] = [];
  for (const entry of context.reorders.filter((item) => item.suggested > 0).slice(0, 3)) {
    const supplier = data.suppliers.find((item) => item.id === data.products.find((product) => product.id === entry.variant.productId)?.supplierId);
    const ev = variantEvidence(data, entry.variant, `${entry.variant.sku}: ${entry.available} available, ${entry.balance?.incoming || 0} incoming, reorder point ${entry.variant.reorderPoint}.`);
    recommendations.push({
      id: id(),
      type: "reorder",
      title: `Reorder ${entry.variant.sku}`,
      recommendation: `Reorder ${entry.suggested} unit(s) of ${entry.variant.sku}${supplier ? ` from ${supplier.name}` : ""}.`,
      reasoning: `Available stock is at or below reorder point while the SKU remains active. The recommendation uses the variant reorder quantity and current balance fields.`,
      assumptions: ["Uses current on-hand, reserved, damaged, quarantine, and incoming balances.", "Supplier choice uses the product's linked supplier when available.", "Live supplier pricing can replace current landed cost later."],
      confidence: 0.84,
      expectedImpact: `Reduces stockout risk while adding about ${money(entry.suggested * entry.variant.landedUnitCost)} in purchase commitments.`,
      risk: "Buying too early can tie up cash if demand slows.",
      approvalRequired: true,
      linkedAction: { label: "Route reorder approval", actionType: "draft_purchase_order", payload: { variantId: entry.variant.id, quantity: entry.suggested, supplierId: supplier?.id } },
      evidenceIds: [ev.id],
      status: "proposed",
      createdAt: now(),
    });
  }
  const finance = context.finance.overview;
  const cashEvidence = evidence(data, "finance", "deployable-cash", "Deployable cash", "/finance", `Deployable cash is ${money(finance.deployableCash)} after reserves, commitments, and obligations.`);
  if (finance.deployableCash > 0) recommendations.push({
    id: id(),
    type: "capital",
    title: "Use deployable cash carefully",
    recommendation: `Keep the operating buffer intact and cap immediate buying at ${money(Math.max(0, finance.deployableCash * 0.45))}.`,
    reasoning: "Faust subtracts pending obligations, purchase commitments, tax reserve, and operating buffer before marking cash deployable.",
    assumptions: ["Pending payouts are treated using confirmed finance records.", "No live bank feed is connected yet."],
    confidence: 0.78,
    expectedImpact: "Preserves runway while funding the highest-confidence replenishment.",
    risk: "Unexpected returns or delayed payouts can reduce available cash.",
    approvalRequired: true,
    linkedAction: { label: "Simulate reinvestment allocation", actionType: "simulate_reinvestment_allocation", payload: { percentage: 45, basis: "deployable_cash" } },
    evidenceIds: [cashEvidence.id],
    status: "proposed",
    createdAt: now(),
  });
  const listingRisk = context.listingRisks[0];
  if (listingRisk && "detail" in listingRisk) {
    const ev = evidence(data, "listing", listingRisk.id, "Listing sync risk", "/listings", listingRisk.detail);
    recommendations.push({ id: id(), type: "delisting", title: "Review listing sync failure", recommendation: `Review ${listingRisk.marketplace} listing issue before increasing quantity exposure.`, reasoning: "Open listing review records can indicate failed publish/sync or manual confirmation gaps.", assumptions: ["Only unresolved listing review records are included."], confidence: 0.73, expectedImpact: "Prevents oversell or stale listing exposure.", risk: "Manual marketplaces may still require extension-assisted confirmation.", approvalRequired: false, linkedAction: { label: "Open listing review", actionType: "retry_listing_sync", payload: { reviewId: listingRisk.id } }, evidenceIds: [ev.id], status: "proposed", createdAt: now() });
  }
  return recommendations;
}

function ensureFreshRecommendations(data: OperatingData) {
  ensureAiCollections(data);
  if (!data.aiRecommendations!.length) data.aiRecommendations!.unshift(...generateAiRecommendations(data));
  return data.aiRecommendations!;
}

function answerForQuestion(data: OperatingData, question: string) {
  const started = Date.now();
  const q = question.toLowerCase();
  const ctx = buildAiOperatingContext(data);
  const evidenceLinks: AiEvidenceLink[] = [];
  let answer = "";
  if (!data.products.length && (q.includes("product") || q.includes("sku") || q.includes("catalog"))) {
    answer = "You currently have no products in Faust. Import your first item from the browser extension or sourcing workspace, then Faust can analyze pricing, inventory, listings, and reorder decisions from your real records.";
  } else if (!data.orders.length && (q.includes("revenue") || q.includes("sales") || q.includes("orders") || q.includes("margin") || q.includes("profit"))) {
    answer = "You have no recorded orders or revenue yet. Once marketplace orders are imported, Faust will calculate sales, fees, COGS, profit, margin, and cash impact from those records.";
  } else if (!data.suppliers.length && q.includes("supplier")) {
    answer = "No supplier records exist yet. Importing a sourced product or creating a purchase order will add supplier context that Faust can use for lead time, defect rate, landed cost, and reorder recommendations.";
  } else if (!data.fulfillmentShipments?.length && q.includes("shipment")) {
    answer = "No shipments exist yet. After orders move into fulfillment, Faust will track picking, packing, labels, dispatch, tracking events, and exceptions.";
  } else if (q.includes("reorder") || q.includes("buy")) {
    const top = ctx.reorders.filter((entry) => entry.suggested > 0)[0];
    if (top) {
      evidenceLinks.push(variantEvidence(data, top.variant, `${top.variant.sku}: ${top.available} available, ${top.balance?.incoming || 0} incoming, reorder quantity ${top.variant.reorderQuantity}.`));
      answer = `Reorder ${top.suggested} unit(s) of ${top.variant.sku}. I am grounding that in current balance state: ${top.available} available, ${top.balance?.incoming || 0} incoming, and reorder point ${top.variant.reorderPoint}.`;
    } else answer = "No SKU currently requires a reorder based on stored balances and reorder points.";
  } else if (q.includes("cash") || q.includes("deployable")) {
    const overview = ctx.finance.overview;
    evidenceLinks.push(evidence(data, "finance", "deployable-cash", "Deployable cash", "/finance", `Cash ${money(overview.cash)}, pending payouts ${money(overview.pendingPayouts)}, commitments ${money(overview.committedPurchaseSpending)}, tax reserve ${money(overview.taxReserve)}.`));
    answer = `Deployable cash is ${money(overview.deployableCash)}. Faust calculated this from cash, confirmed pending payouts, unpaid obligations, committed purchase orders, tax reserve, and the operating buffer.`;
  } else if (q.includes("margin") || q.includes("profit")) {
    const order = data.orders[0]; const profit = order ? orderProfit(order, data.variants) : undefined;
    if (order && profit) evidenceLinks.push(evidence(data, "order", order.id, order.number, "/orders", `${order.number}: ${money(profit.netSales)} net sales, ${money(profit.cogs)} COGS, ${money(profit.fees)} fees/shipping/packaging.`));
    answer = profit ? `Margin is being driven by known fees, seller-paid shipping, and COGS. For ${order!.number}, contribution profit is ${money(profit.contributionProfit)} on ${money(profit.netSales)} net sales.` : "There are no completed order records to explain margin yet.";
  } else if (q.includes("channel") || q.includes("marketplace")) {
    const best = [...ctx.analytics.channels].sort((a, b) => b.profit - a.profit)[0];
    if (best) evidenceLinks.push(evidence(data, "analytics", `channel:${best.marketplace}`, best.marketplace, "/analytics", `${best.marketplace}: ${money(best.revenue)} revenue, ${money(best.profit)} profit, ${round(best.margin)}% margin.`));
    answer = best ? `${best.marketplace} is currently the strongest channel by stored profit: ${money(best.profit)} on ${money(best.revenue)} revenue.` : "No channel has enough stored order data to rank profitability yet.";
  } else if (q.includes("supplier")) {
    const supplier = (data.supplierScorecards || [])[0]; const record = supplier ? data.suppliers.find((entry) => entry.id === supplier.supplierId) : data.suppliers[0];
    if (record) evidenceLinks.push(evidence(data, "supplier", record.id, record.name, "/purchasing", supplier ? `Score ${supplier.qualityScore}/${supplier.leadTimeScore}/${supplier.communicationScore}; defect rate ${round(supplier.defectRate * 100)}%.` : `Lead days ${record.leadDays || "unknown"}, rating ${record.rating || "unknown"}.`));
    answer = record ? `${record.name} is the supplier to watch. Faust is using stored scorecard/lead-time evidence instead of guessing from messages.` : "No supplier records exist yet.";
  } else if (q.includes("shipment")) {
    const shipment = ctx.shipmentsNeedingAttention[0];
    if (shipment) evidenceLinks.push(evidence(data, "fulfillment", shipment.id, shipment.trackingNumber || shipment.id, "/shipping", `Shipment status ${shipment.status}; tracking ${shipment.trackingStatus || "not refreshed"}.`));
    answer = shipment ? `Shipment ${shipment.trackingNumber || shipment.id} needs attention because it is in ${shipment.status}.` : "No shipment exceptions or delayed tracking records are open.";
  } else if (q.includes("automation")) {
    const failure = ctx.automationFailures[0];
    if (failure) evidenceLinks.push(evidence(data, "automation", failure.id, "Automation failure", "/automations", "Open failed/dead-letter automation record."));
    answer = failure ? "There is at least one automation failure/dead-letter record to inspect in Automations." : "No failed automation runs or open automation dead letters are present.";
  } else {
    const totalEvidence = data.orders.length + data.balances.length + data.transactions.length + data.suppliers.length;
    evidenceLinks.push(evidence(data, "analytics", "source-record-count", "Faust source records", "/analytics", `${totalEvidence} source records are available for this answer.`));
    answer = "I can only answer from Faust records. Try asking about reorder priorities, deployable cash, margin, channels, suppliers, shipments, listings, or automations.";
  }
  const call = tool(data, "ai.internal_records.query", { question }, `${evidenceLinks.length} evidence record(s) returned.`, evidenceLinks.map((entry) => entry.id), started);
  return { answer, evidenceLinks, toolCalls: [call] };
}

export async function askAiCenter(data: OperatingData, input: Extract<AiCenterActionInput, { action: "ask-question" }>) {
  ensureAiCollections(data);
  const provider = input.provider || "deterministic";
  const conversation: AiConversation = input.conversationId ? data.aiConversations!.find((entry) => entry.id === input.conversationId) || { id: input.conversationId, title: input.question.slice(0, 80), provider, status: "active", messageIds: [], savedQuestionIds: [], createdAt: now() } : { id: id(), title: input.question.slice(0, 80), provider, status: "active", messageIds: [], savedQuestionIds: [], createdAt: now() };
  if (!data.aiConversations!.some((entry) => entry.id === conversation.id)) data.aiConversations!.unshift(conversation);
  const userMessage: AiMessage = { id: id(), conversationId: conversation.id, role: "user", content: input.question, provider, grounded: true, evidenceIds: [], toolCallIds: [], recommendationIds: [], scenarioIds: [], createdAt: now() };
  const grounded = answerForQuestion(data, input.question);
  const providerResult = await aiProviderAdapters[provider].answer({ question: input.question, deterministicAnswer: grounded.answer, evidence: grounded.evidenceLinks });
  const recommendations = ensureFreshRecommendations(data).slice(0, 2);
  const assistantMessage: AiMessage = { id: id(), conversationId: conversation.id, role: "assistant", content: providerResult.content, provider, grounded: true, evidenceIds: grounded.evidenceLinks.map((entry) => entry.id), toolCallIds: grounded.toolCalls.map((entry) => entry.id), recommendationIds: recommendations.map((entry) => entry.id), scenarioIds: [], createdAt: now() };
  grounded.toolCalls.forEach((entry) => { entry.conversationId = conversation.id; entry.messageId = assistantMessage.id; });
  data.aiMessages!.push(userMessage, assistantMessage);
  conversation.messageIds.push(userMessage.id, assistantMessage.id);
  conversation.updatedAt = now();
  if (input.saveQuestion && !data.aiSavedQuestions!.some((entry) => entry.question.toLowerCase() === input.question.toLowerCase())) {
    const saved: AiSavedQuestion = { id: id(), question: input.question, category: "general", createdAt: now(), lastAskedAt: now() };
    data.aiSavedQuestions!.unshift(saved);
    conversation.savedQuestionIds.push(saved.id);
  }
  const observability: AiObservabilityEvent = { id: id(), provider, model: providerResult.model, latencyMs: grounded.toolCalls.reduce((sum, entry) => sum + entry.latencyMs, 0), tokenUsage: providerResult.tokenUsage, estimatedCostUsd: providerResult.estimatedCostUsd || 0, toolCallIds: grounded.toolCalls.map((entry) => entry.id), retryCount: 0, confidence: grounded.evidenceLinks.length ? Math.min(0.95, grounded.evidenceLinks.reduce((sum, entry) => sum + entry.confidence, 0) / grounded.evidenceLinks.length) : 0.5, createdAt: now() };
  data.aiObservabilityEvents!.unshift(observability);
  addActivity(data, "AI Center answered question", "ai_conversation", conversation.id, `${input.question} grounded with ${assistantMessage.evidenceIds.length} evidence link(s).`);
  return { conversation, message: assistantMessage, observability };
}

export function generateAiDailyBrief(data: OperatingData, provider: AiProviderKey = "deterministic") {
  ensureAiCollections(data);
  const ctx = buildAiOperatingContext(data);
  const recommendations = ensureFreshRecommendations(data).slice(0, 5);
  const sections: AiDailyBrief["sections"] = [];
  const financeEvidence = evidence(data, "finance", "daily-brief-finance", "Finance overview", "/finance", `Deployable cash ${money(ctx.finance.overview.deployableCash)}, operating profit ${money(ctx.finance.overview.operatingProfit)}.`);
  sections.push({ title: "Cash and profit", summary: `Deployable cash is ${money(ctx.finance.overview.deployableCash)} and operating profit is ${money(ctx.finance.overview.operatingProfit)}.`, severity: ctx.finance.overview.deployableCash < 0 ? "critical" : "info", evidenceIds: [financeEvidence.id], href: "/finance" });
  for (const reorder of ctx.reorders.filter((entry) => entry.suggested > 0).slice(0, 2)) {
    const ev = variantEvidence(data, reorder.variant, `${reorder.variant.sku}: ${reorder.available} available, ${reorder.suggested} suggested.`);
    sections.push({ title: "Inventory risk", summary: `${reorder.variant.sku} is at reorder threshold. Suggested reorder: ${reorder.suggested}.`, severity: "warning", evidenceIds: [ev.id], href: "/inventory" });
  }
  if (ctx.shipmentsNeedingAttention.length) {
    const shipment = ctx.shipmentsNeedingAttention[0];
    const ev = evidence(data, "fulfillment", shipment.id, "Fulfillment exception", "/shipping", `Shipment ${shipment.id} is ${shipment.status}.`);
    sections.push({ title: "Fulfillment exceptions", summary: `${ctx.shipmentsNeedingAttention.length} shipment(s) need attention.`, severity: "critical", evidenceIds: [ev.id], href: "/shipping" });
  }
  if (ctx.listingRisks.length) sections.push({ title: "Listing sync", summary: `${ctx.listingRisks.length} listing/sync risk record(s) are open.`, severity: "warning", evidenceIds: [], href: "/listings" });
  if (ctx.automationFailures.length) sections.push({ title: "Automation failures", summary: `${ctx.automationFailures.length} automation failure/dead-letter record(s) need review.`, severity: "warning", evidenceIds: [], href: "/automations" });
  const brief: AiDailyBrief = { id: id(), date: now().slice(0, 10), provider, mode: "deterministic", sections, recommendationIds: recommendations.map((entry) => entry.id), createdAt: now() };
  data.aiDailyBriefs!.unshift(brief);
  addActivity(data, "AI Center generated daily brief", "ai_daily_brief", brief.id, `${sections.length} grounded section(s).`);
  return brief;
}

export function runAiScenario(data: OperatingData, input: Extract<AiCenterActionInput, { action: "run-scenario" }>) {
  ensureAiCollections(data);
  const finance = buildFinanceModel(data).overview;
  const variant = data.variants.find((entry) => entry.id === input.variantId) || data.variants[0];
  const units = Number(input.units || 100);
  const priceChangePercent = Number(input.priceChangePercent || 0);
  const unitCost = variant?.landedUnitCost || 0;
  const purchaseCommitments = round(units * unitCost);
  const projectedRevenue = round(data.orders.reduce((sum, order) => sum + orderProfit(order, data.variants).netSales, 0) * (1 + priceChangePercent / 100));
  const projectedProfit = round(buildFinanceModel(data).overview.contributionProfit + projectedRevenue * (priceChangePercent / 100) - purchaseCommitments * 0.08 - Number(input.marketingBudgetChange || 0));
  const ev = variant ? variantEvidence(data, variant, `${variant.sku}: landed cost ${money(unitCost)}, reorder quantity ${variant.reorderQuantity}.`) : evidence(data, "finance", "scenario-finance", "Finance context", "/finance", `Deployable cash ${money(finance.deployableCash)}.`);
  const scenario: AiScenario = { id: id(), name: input.name || "AI scenario", prompt: input.prompt, inputs: { units, variantId: variant?.id || "", priceChangePercent, supplierId: input.supplierId || "", marketingBudgetChange: Number(input.marketingBudgetChange || 0), reserveCash: Number(input.reserveCash || 0) }, impacts: { cash: round(finance.cash - purchaseCommitments - Number(input.marketingBudgetChange || 0)), deployableCash: round(finance.deployableCash - purchaseCommitments - Number(input.reserveCash || 0)), margin: round(finance.margin + priceChangePercent * 0.35), stockoutRisk: Math.max(0.05, round(0.5 - units / 1000)), inventoryDays: Math.min(365, Math.round(units / Math.max(1, data.orders.length || 1) * 30)), forecastRevenue: projectedRevenue, profit: projectedProfit, purchaseCommitments }, assumptions: ["Uses current finance model as source of truth.", "Supplier cost uses variant landed cost until live supplier quotes are connected.", "Scenario does not execute purchases or price changes."], confidence: 0.72, evidenceIds: [ev.id], createdAt: now() };
  data.aiScenarios!.unshift(scenario);
  addActivity(data, "AI Center ran scenario", "ai_scenario", scenario.id, `${units} units, ${priceChangePercent}% price change.`);
  return scenario;
}

export function saveAiRecommendation(data: OperatingData, recommendationId: string) {
  ensureAiCollections(data);
  const recommendation = data.aiRecommendations!.find((entry) => entry.id === recommendationId);
  if (!recommendation) throw new Error("Recommendation not found.");
  recommendation.status = "saved";
  recommendation.updatedAt = now();
  addActivity(data, "AI recommendation saved", "ai_recommendation", recommendation.id, recommendation.title);
  return recommendation;
}

export function routeAiRecommendationForApproval(data: OperatingData, recommendationId: string, reason = "AI Center recommendation requires approval before execution.") {
  ensureAiCollections(data);
  data.automationApprovals ||= [];
  const recommendation = data.aiRecommendations!.find((entry) => entry.id === recommendationId);
  if (!recommendation) throw new Error("Recommendation not found.");
  if (!recommendation.approvalRequired) throw new Error("This recommendation does not require approval.");
  const approval: AutomationApproval = { id: id(), ruleId: "ai-center", status: "pending", approverRole: "owner", requestedBy: "AI Center", reason, linkedRecords: [{ type: "ai_recommendation", id: recommendation.id, href: "/ai-center" }, ...recommendation.evidenceIds.map((evidenceId) => ({ type: "ai_evidence", id: evidenceId, href: "/ai-center" }))], proposedAction: recommendation.linkedAction?.actionType || "review", beforeValue: {}, afterValue: recommendation.linkedAction?.payload || {}, expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(), requestedAt: now(), history: [`${now()}: AI Center routed recommendation for approval.`] };
  data.automationApprovals!.unshift(approval);
  const proposal: AiApprovalProposal = { id: id(), recommendationId, automationApprovalId: approval.id, actionType: recommendation.linkedAction?.actionType || "review", payload: recommendation.linkedAction?.payload || {}, status: "pending", requestedBy: "AI Center", reason, createdAt: now() };
  data.aiApprovalProposals!.unshift(proposal);
  recommendation.status = "approval_requested";
  recommendation.updatedAt = now();
  addActivity(data, "AI recommendation routed for approval", "automation_approval", approval.id, recommendation.title);
  return proposal;
}

export function recordAiFeedback(data: OperatingData, input: Extract<AiCenterActionInput, { action: "feedback" }>) {
  ensureAiCollections(data);
  const feedback: AiFeedback = { id: id(), messageId: input.messageId, recommendationId: input.recommendationId, rating: input.rating, comment: input.comment, createdAt: now() };
  data.aiFeedback!.unshift(feedback);
  addActivity(data, "AI feedback recorded", "ai_feedback", feedback.id, input.rating);
  return feedback;
}

export async function mutateAiCenterData(data: OperatingData, input: AiCenterActionInput) {
  ensureAiCollections(data);
  if (input.action === "ask-question") return askAiCenter(data, input);
  if (input.action === "daily-brief") return generateAiDailyBrief(data, input.provider);
  if (input.action === "run-scenario") return runAiScenario(data, input);
  if (input.action === "save-recommendation") return saveAiRecommendation(data, input.recommendationId);
  if (input.action === "request-approval") return routeAiRecommendationForApproval(data, input.recommendationId, input.reason);
  if (input.action === "feedback") return recordAiFeedback(data, input);
  throw new Error("Unsupported AI Center action.");
}
