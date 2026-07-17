import assert from "node:assert/strict";
import { test } from "node:test";
import type { OperatingData } from "../domain/business";
import { askAiCenter, ensureAiCollections, generateAiDailyBrief, generateAiRecommendations, recordAiFeedback, routeAiRecommendationForApproval, runAiScenario, saveAiRecommendation } from "../lib/ai-center";

const fixture = (): OperatingData => {
  const time = "2026-07-01T12:00:00.000Z";
  const supplierId = crypto.randomUUID();
  const productId = crypto.randomUUID();
  const variantId = crypto.randomUUID();
  const customerId = crypto.randomUUID();
  const orderId = crypto.randomUUID();
  return {
    version: 1, mode: "local", updatedAt: time,
    products: [{ id: productId, title: "AI hoodie", category: "Streetwear", tags: ["ai"], supplierId, status: "active", createdAt: time, updatedAt: time }],
    variants: [{ id: variantId, productId, sku: "AI-HOOD-L", title: "AI Hoodie / L", condition: "New", landedUnitCost: 20, defaultSalePrice: 80, reorderPoint: 2, reorderQuantity: 8, active: true }],
    locations: [], balances: [{ id: crypto.randomUUID(), variantId, onHand: 2, reserved: 1, incoming: 0, damaged: 0, returned: 0, lost: 0, quarantined: 0 }], stockMovements: [],
    suppliers: [{ id: supplierId, name: "AI Supplier", sourcePlatform: "1688", leadDays: 12, rating: 4.3, status: "active" }],
    purchaseOrders: [], parcels: [], listings: [{ id: crypto.randomUUID(), variantId, marketplace: "Depop", title: "AI Hoodie", price: 80, quantity: 1, status: "active", syncState: "manual", createdAt: time }],
    customers: [{ id: customerId, name: "AI Buyer", orderCount: 1, lifetimeValue: 88, issueCount: 0 }],
    orders: [{ id: orderId, number: "AI-100", marketplace: "Depop", customerId, status: "delivered", orderedAt: time, shippingCharged: 8, shippingCost: 6, marketplaceFee: 5, paymentFee: 2, taxCollected: 0, items: [{ id: crypto.randomUUID(), variantId, title: "AI Hoodie / L", quantity: 1, unitSellingPrice: 80, discountAllocation: 0, taxAllocation: 0, feeAllocation: 1, unitCost: 20 }] }],
    transactions: [{ id: crypto.randomUUID(), type: "payout", amount: 75, status: "cleared", occurredAt: time, orderId, description: "Depop payout", category: "Payout" }],
    tasks: [], notices: [], insights: [], activity: [],
    supplierScorecards: [{ id: crypto.randomUUID(), supplierId, qualityScore: 82, leadTimeScore: 74, communicationScore: 78, priceScore: 80, defectRate: 0.08, onTimeRate: 0.86, averageLeadDays: 12, totalSpendUsd: 300, claimCount: 2, lastReviewedAt: time, updatedAt: time }],
    automationRuns: [], automationDeadLetters: [], automationApprovals: [],
  };
};

test("AI Center deterministic answers are grounded in Faust evidence", async () => {
  const data = fixture();
  const result = await askAiCenter(data, { action: "ask-question", question: "What should I reorder today?", saveQuestion: true, provider: "deterministic" });
  assert.match(result.message.content, /AI-HOOD-L/);
  assert.ok(result.message.evidenceIds.length > 0);
  assert.ok(data.aiToolCalls?.some((call) => call.toolName === "ai.internal_records.query"));
  assert.ok(data.aiSavedQuestions?.some((question) => question.question === "What should I reorder today?"));
});

test("AI Center OpenAI adapter uses grounded evidence when configured", async () => {
  const data = fixture();
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_MODEL;
  process.env.OPENAI_API_KEY = "sk-test-openai";
  process.env.OPENAI_MODEL = "gpt-test";
  let requestedBody = "";
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(String(url), "https://api.openai.com/v1/responses");
    assert.equal(init?.headers && "Authorization" in (init.headers as Record<string, string>) ? (init.headers as Record<string, string>).Authorization : "", "Bearer sk-test-openai");
    requestedBody = String(init?.body || "");
    return new Response(JSON.stringify({ output_text: "Model answer grounded in AI-HOOD-L evidence.", usage: { input_tokens: 42, output_tokens: 11 } }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  try {
    const result = await askAiCenter(data, { action: "ask-question", question: "What should I reorder today?", provider: "openai" });
    assert.match(result.message.content, /Model answer grounded/);
    assert.match(requestedBody, /AI-HOOD-L/);
    assert.equal(result.observability.provider, "openai");
    assert.equal(result.observability.model, "gpt-test");
    assert.deepEqual(result.observability.tokenUsage, { input: 42, output: 11 });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = originalKey;
    if (originalModel === undefined) delete process.env.OPENAI_MODEL; else process.env.OPENAI_MODEL = originalModel;
  }
});

test("AI Center creates evidence-backed recommendations and approval routes", () => {
  const data = fixture();
  ensureAiCollections(data);
  const recommendations = generateAiRecommendations(data);
  data.aiRecommendations!.push(...recommendations);
  const reorder = recommendations.find((entry) => entry.type === "reorder");
  assert.ok(reorder);
  assert.ok(reorder!.evidenceIds.length > 0);
  saveAiRecommendation(data, reorder!.id);
  assert.equal(data.aiRecommendations?.find((entry) => entry.id === reorder!.id)?.status, "saved");
  const proposal = routeAiRecommendationForApproval(data, reorder!.id);
  assert.equal(proposal.status, "pending");
  assert.equal(data.automationApprovals?.[0].status, "pending");
});

test("AI Center scenarios use real finance and inventory inputs", () => {
  const data = fixture();
  const scenario = runAiScenario(data, { action: "run-scenario", name: "Buy 300 units", prompt: "What happens if I buy 300 units?", units: 300, variantId: data.variants[0].id, priceChangePercent: 10, reserveCash: 100 });
  assert.equal(scenario.impacts.purchaseCommitments, 6000);
  assert.ok(scenario.evidenceIds.length > 0);
  assert.ok(scenario.assumptions.some((entry) => entry.includes("finance model")));
});

test("AI Center daily brief and unsupported questions avoid fake claims", async () => {
  const data = fixture();
  const brief = generateAiDailyBrief(data);
  assert.ok(brief.sections.some((section) => section.title === "Cash and profit"));
  const answer = await askAiCenter(data, { action: "ask-question", question: "Tell me something from Instagram DMs", provider: "deterministic" });
  assert.match(answer.message.content, /only answer from Faust records/i);
  assert.ok(answer.message.grounded);
});

test("AI Center feedback persists against recommendation or answer records", async () => {
  const data = fixture();
  const answer = await askAiCenter(data, { action: "ask-question", question: "How much deployable cash can I safely use?", provider: "deterministic" });
  const feedback = recordAiFeedback(data, { action: "feedback", messageId: answer.message.id, rating: "useful", comment: "Grounded and clear." });
  assert.equal(feedback.rating, "useful");
  assert.equal(data.aiFeedback?.length, 1);
});
