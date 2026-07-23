import assert from "node:assert/strict";
import { test } from "node:test";
import type { ProductExperience } from "../lib/product-experience";
import { buildProductDnaProfile } from "../lib/product-dna";

function experience(overrides: Partial<ProductExperience> = {}): ProductExperience {
  const base = {
    product: { id: "product-dna", title: "DNA product", category: "T-shirt", tags: [], status: "draft", createdAt: "2026-07-23T00:00:00.000Z", updatedAt: "2026-07-23T00:00:00.000Z" },
    variant: { id: "variant-dna", productId: "product-dna", sku: "DNA-001", title: "Black / L", condition: "New", landedUnitCost: 0, defaultSalePrice: 0, reorderPoint: 2, reorderQuantity: 8, active: true },
    href: "/catalog/variant-dna",
    supplierName: "Supplier not linked",
    supplierDetail: "Link supplier before purchasing.",
    readiness: { score: 0, status: "needs_work", missing: [], nextAction: "Complete product details", dimensions: [] },
    inventory: { onHand: 0, reserved: 0, available: 0, incoming: 0, damaged: 0, returned: 0, lost: 0, quarantined: 0, value: 0 },
    finance: { cost: 0, sellingPrice: 0, revenue: 0, profit: 0, margin: 0, roi: 0, averageSellingPrice: 0, cashInvested: 0, cashReturned: 0, projectedRevenue: 0 },
    analytics: { unitsSold: 0, returns: 0, sellThrough: 0, bestMarketplace: "Not proven yet", velocityLabel: "No sales velocity yet" },
    purchasing: { leadTime: "Unknown", moq: "Unknown", reorderPoint: 2, recommendedReorderQuantity: 8, openPurchaseOrders: 0, purchasingHistory: 0 },
    marketplaces: [
      { marketplace: "Depop", status: "pending", detail: "Draft not generated" },
      { marketplace: "eBay", status: "pending", detail: "Draft not generated" },
      { marketplace: "Etsy", status: "pending", detail: "Draft not generated" },
      { marketplace: "Mercari", status: "pending", detail: "Draft not generated" },
      { marketplace: "Poshmark", status: "pending", detail: "Draft not generated" },
    ],
    ai: { recommendation: "", confidence: 0, evidence: "", nextAction: "Complete product details" },
    intelligence: { faustScore: { score: 0, label: "New", explanation: "", components: [] }, health: [], dna: [], relationships: [], recommendation: { situation: "", reasoning: "", expectedOutcome: "", confidence: 0, confidenceBasis: [] } },
    timeline: [],
  } satisfies ProductExperience;
  return { ...base, ...overrides } as ProductExperience;
}

test("product DNA starts as an initial knowledge core without product image state", () => {
  const profile = buildProductDnaProfile(experience(), "2026-07-23T00:00:00.000Z");

  assert.equal(profile.productId, "product-dna");
  assert.equal(profile.stage, "initial");
  assert.equal(profile.stageLabel, "Initial");
  assert.ok(profile.missingInputs.includes("Add more product photos"));
  assert.ok(profile.missingInputs.includes("Complete pricing and cost assumptions"));
  assert.equal(profile.calculationVersion, "faust-product-dna-core-v1");
});

test("product DNA strengthens from operating intelligence rather than a cutout asset", () => {
  const profile = buildProductDnaProfile(experience({
    product: { id: "product-dna", title: "Strong DNA product", brand: "Faust", category: "T-shirt", description: "Heavy cotton tee", tags: ["streetwear"], images: ["https://cdn.example.test/one.jpg", "https://cdn.example.test/two.jpg", "https://cdn.example.test/three.jpg", "https://cdn.example.test/four.jpg", "https://cdn.example.test/five.jpg"], status: "active", createdAt: "2026-07-23T00:00:00.000Z", updatedAt: "2026-07-23T00:00:00.000Z" },
    variant: { id: "variant-dna", productId: "product-dna", sku: "DNA-001", title: "Black / L", condition: "New", landedUnitCost: 12, defaultSalePrice: 48, reorderPoint: 2, reorderQuantity: 8, active: true },
    supplierName: "North Star Trading",
    purchasing: { leadTime: "12 days", moq: "12", reorderPoint: 2, recommendedReorderQuantity: 8, openPurchaseOrders: 1, purchasingHistory: 3 },
    inventory: { onHand: 12, reserved: 1, available: 11, incoming: 4, damaged: 0, returned: 0, lost: 0, quarantined: 0, value: 144 },
    finance: { cost: 12, sellingPrice: 48, revenue: 480, profit: 240, margin: 50, roi: 300, averageSellingPrice: 48, cashInvested: 144, cashReturned: 480, projectedRevenue: 528 },
    analytics: { unitsSold: 10, returns: 0, sellThrough: 45, bestMarketplace: "Depop", velocityLabel: "10 unit(s) sold" },
    marketplaces: [
      { marketplace: "Depop", status: "live", detail: "Live" },
      { marketplace: "eBay", status: "live", detail: "Live" },
      { marketplace: "Etsy", status: "draft", detail: "Draft" },
      { marketplace: "Mercari", status: "draft", detail: "Draft" },
      { marketplace: "Poshmark", status: "draft", detail: "Draft" },
    ],
    timeline: Array.from({ length: 8 }).map((_, index) => ({ id: `event-${index}`, title: "Activity", detail: "Recorded", at: "2026-07-23T00:00:00.000Z" })),
  }), "2026-07-23T00:00:00.000Z");

  assert.ok(["strong", "established"].includes(profile.stage));
  assert.ok(profile.strengthScore >= 70);
  assert.equal(profile.confidenceBreakdown.images, 100);
  assert.notEqual(profile.recommendedNextStep, "Add more product photos");
});
