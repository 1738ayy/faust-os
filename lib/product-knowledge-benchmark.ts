import type { OperatingData, ProductKnowledgeFieldKey } from "../domain/business";
import { buildProductKnowledgeFromSuperbuy, productKnowledgeSummary, productKnowledgeValue } from "./product-knowledge";
import type { SuperbuyProduct } from "../types/superbuy-product";

type ExpectedTruth =
  | { expectation: "exact"; value: string | number | Record<string, unknown> }
  | { expectation: "acceptable"; values: (string | number)[] }
  | { expectation: "unknown" | "not_present" };

export type ProductKnowledgeBenchmarkFixture = {
  id: string;
  category: string;
  source: SuperbuyProduct;
  expected: Partial<Record<ProductKnowledgeFieldKey, ExpectedTruth>>;
  notes: string[];
};

const time = "2026-07-27T00:00:00.000Z";

const categoryExpectations: Record<string, { sourceLabel: string; expectedCategory: string; titleNoun: string }> = {
  "T-shirts": { sourceLabel: "T-shirt", expectedCategory: "T-shirt", titleNoun: "graphic T-shirt" },
  Tops: { sourceLabel: "Women Tops", expectedCategory: "Tops", titleNoun: "mesh top" },
  Jeans: { sourceLabel: "Jeans", expectedCategory: "Jeans", titleNoun: "wide leg jeans" },
  Shorts: { sourceLabel: "Shorts", expectedCategory: "Shorts", titleNoun: "denim shorts" },
  Jewelry: { sourceLabel: "Jewelry", expectedCategory: "Jewelry", titleNoun: "statement jewelry set" },
  Necklaces: { sourceLabel: "Necklace", expectedCategory: "Necklace", titleNoun: "chain necklace" },
  Bracelets: { sourceLabel: "Bracelet", expectedCategory: "Bracelet", titleNoun: "charm bracelet" },
  Belts: { sourceLabel: "Belt", expectedCategory: "Belt", titleNoun: "studded belt" },
  Handbags: { sourceLabel: "Bags > Shoulder Bags", expectedCategory: "Bags", titleNoun: "crescent handbag" },
  Accessories: { sourceLabel: "Fashion accessories", expectedCategory: "Accessories", titleNoun: "hair accessory" },
};

const materials = ["Cotton blend", "Polyester", "Denim", "PU leather", "Titanium steel", "Alloy", "Canvas", "Acrylic", "Viscose", "Shell"];
const suppliers = [
  "SHOPVisit StoreShangrao Nanxi Clothing Co., Ltd3.7OverallDescription3.0Service4.5Logistics3.",
  "English/ USD Shopping AssistantShipping Calculator >Forwarding >Parcel Tracking > Guangzhou Chenyi E-commerce Co., Ltd",
  "Yiwu Yuxin Jewelry Factory",
  "Hangzhou North Star Trading Co., Ltd",
  "Dongguan Silver River Bag Factory",
];

function variantGroups(index: number) {
  const colorOptions = ["Black", "White", "Gray Blue", "Washed Red", "Brown"].slice(0, 2 + index % 4);
  const sizeOptions = ["S", "M", "L", "XL"].slice(0, 2 + index % 3);
  return {
    groups: [
      { label: index % 2 ? "颜色" : "Color", translatedLabel: "Color", options: colorOptions.map((label, position) => ({ id: `color-${position}`, label, price: 8 + position, stock: 20 + position + index })) },
      { label: "Size", options: sizeOptions.map((label, position) => ({ id: `size-${position}`, label, stock: 15 + position })) },
    ],
    combinations: colorOptions.flatMap((color, colorIndex) => sizeOptions.map((size, sizeIndex) => ({ optionIds: [`color-${colorIndex}`, `size-${sizeIndex}`], labels: [color, size], price: 8 + colorIndex + sizeIndex, stock: 10 + colorIndex + sizeIndex + index, available: true }))),
  };
}

function benchmarkFixture(index: number, category: string): ProductKnowledgeBenchmarkFixture {
  const categoryInfo = categoryExpectations[category];
  const material = materials[index % materials.length];
  const supplier = suppliers[index % suppliers.length];
  const incomplete = index % 7 === 0;
  const conflict = index % 6 === 0;
  const chineseLabels = index % 3 === 0;
  const tiered = index % 4 === 0;
  const groups = variantGroups(index);
  const stock = groups.combinations.reduce((sum, combo) => sum + (combo.stock || 0), 0);
  const attrs: Record<string, string | number | boolean | string[]> = {};
  attrs[chineseLabels ? "产品类别" : "Product Category"] = categoryInfo.sourceLabel;
  if (!incomplete) attrs[chineseLabels ? "主要面料成分" : "Main Fabric Composition"] = material;
  if (conflict) attrs.Material = material === "Cotton blend" ? "Polyester" : "Cotton blend";
  if (index % 5 === 0) attrs[chineseLabels ? "起订量" : "MOQ"] = 3 + index % 4;
  if (index % 2 === 0) attrs[chineseLabels ? "库存" : "Stock"] = stock;

  const source: SuperbuyProduct = {
    source: index % 2 ? "superbuy" : "1688",
    importedAt: time,
    title: `Benchmark ${categoryInfo.titleNoun} ${index + 1}`,
    superbuyUrl: `https://www.superbuy.com/en/page/buy/?url=https%3A%2F%2Fdetail.1688.com%2Foffer%2Fbenchmark-${index}.html`,
    original1688Url: `https://detail.1688.com/offer/benchmark-${index}.html`,
    storeName: supplier,
    category: categoryInfo.sourceLabel,
    rawAttributes: attrs,
    images: Array.from({ length: 3 + index % 5 }, (_, imageIndex) => `https://img.example.test/benchmark-${index}-${imageIndex}.jpg`),
    variants: groups.combinations.map((combo, comboIndex) => ({ id: `variant-${index}-${comboIndex}`, name: combo.labels.join(" / "), options: combo.labels, price: combo.price, stock: combo.stock, image: `https://img.example.test/benchmark-${index}-${comboIndex % 3}.jpg` })),
    variantOptions: groups,
    price: 8 + index,
    priceCurrency: tiered ? "RMB" : "USD",
    priceRange: tiered ? { min: 8 + index, max: 11 + index } : undefined,
    priceTiers: tiered ? [{ minimumQuantity: 1, price: 8 + index, currency: "RMB" }, { minimumQuantity: 20, price: 7 + index, currency: "RMB" }] : [],
    domesticShipping: incomplete ? undefined : 4 + index % 5,
    domesticShippingCurrency: tiered ? "RMB" : "USD",
    weight: incomplete && index % 2 ? undefined : `${120 + index * 9}g`,
    dimensions: incomplete ? undefined : "30 x 22 x 4 cm",
    minimumOrderQuantity: Number(attrs[chineseLabels ? "起订量" : "MOQ"]) || undefined,
    stock: Number(attrs[chineseLabels ? "库存" : "Stock"]) || undefined,
  };

  return {
    id: `benchmark-${index + 1}`,
    category,
    source,
    notes: [
      incomplete ? "incomplete metadata" : "complete supplier metadata",
      conflict ? "conflicting material signals" : "single material signal",
      chineseLabels ? "mixed Chinese labels" : "English labels",
      tiered ? "tiered RMB prices" : "single display price",
    ],
    expected: {
      supplier_shop: { expectation: "acceptable", values: ["Shangrao Nanxi Clothing Co., Ltd", "Guangzhou Chenyi E-commerce Co., Ltd", "Yiwu Yuxin Jewelry Factory", "Hangzhou North Star Trading Co., Ltd", "Dongguan Silver River Bag Factory"] },
      suggested_title: { expectation: "exact", value: source.title },
      product_type: { expectation: "exact", value: categoryInfo.sourceLabel },
      universal_category: { expectation: "acceptable", values: [categoryInfo.expectedCategory, categoryInfo.sourceLabel] },
      material: incomplete ? { expectation: "unknown" } : conflict ? { expectation: "acceptable", values: [material, "Cotton blend", "Polyester"] } : { expectation: "exact", value: material },
      price: { expectation: "exact", value: { minimum: source.priceRange?.min ?? source.price, maximum: source.priceRange?.max ?? source.price, currency: source.priceCurrency || "USD" } },
      domestic_shipping: incomplete ? { expectation: "unknown" } : { expectation: "exact", value: { amount: source.domesticShipping, currency: source.domesticShippingCurrency || "USD" } },
      stock: source.stock === undefined ? { expectation: "acceptable", values: [stock] } : { expectation: "exact", value: source.stock },
      weight: source.weight ? { expectation: "exact", value: source.weight } : { expectation: "unknown" },
      image_set: { expectation: "exact", value: { count: source.images.length } },
      variant_options: { expectation: "exact", value: { combinations: groups.combinations.length } },
    },
  };
}

export const productKnowledgeBenchmarkFixtures: ProductKnowledgeBenchmarkFixture[] = Array.from({ length: 30 }, (_, index) => {
  const categories = Object.keys(categoryExpectations);
  return benchmarkFixture(index, categories[index % categories.length]);
});

function compact(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function valueMatches(actual: unknown, expected: ExpectedTruth) {
  if (expected.expectation === "unknown" || expected.expectation === "not_present") return actual === undefined || actual === null || actual === "";
  if (expected.expectation === "acceptable") return expected.values.some((value) => compact(actual) === compact(value));
  if (expected.expectation === "exact" && typeof expected.value === "object" && expected.value !== null) {
    const record = actual as Record<string, unknown> | undefined;
    if ("count" in expected.value) return Array.isArray(actual) && actual.length === expected.value.count;
    if ("combinations" in expected.value) return Array.isArray(record?.combinations) && record?.combinations.length === expected.value.combinations;
    return Object.entries(expected.value).every(([key, value]) => compact(record?.[key]) === compact(value));
  }
  return expected.expectation === "exact" && compact(actual) === compact(expected.value);
}

export function evaluateProductKnowledgeBenchmark(fixtures = productKnowledgeBenchmarkFixtures) {
  const data: OperatingData = { version: 1, mode: "local", updatedAt: time, products: [], productImages: [], productDigitalTwins: [], productKnowledgeEvidence: [], productKnowledgeFields: [], productKnowledgeDecisions: [], productKnowledgeMemory: [], productKnowledgeConfidenceHistory: [], variants: [], locations: [], balances: [], stockMovements: [], suppliers: [], purchaseOrders: [], parcels: [], listings: [], customers: [], orders: [], transactions: [], tasks: [], notices: [], insights: [], activity: [], purchaseBatches: [], landedCostComponents: [], marketplaceAccounts: [], listingTemplates: [], channelListingDrafts: [], listingSyncJobs: [], listingReviewItems: [], physicalSkuMappings: [], outboxEvents: [], durableJobs: [], deadLetters: [], channelSyncStates: [], inventoryRiskLocks: [] };
  const fieldResults: { fixtureId: string; fieldKey: ProductKnowledgeFieldKey; expected: ExpectedTruth; actual: unknown; correct: boolean; confidence: number }[] = [];
  for (const fixture of fixtures) {
    const productId = crypto.randomUUID();
    data.products.push({ id: productId, title: fixture.source.title, category: "Imported", tags: [], status: "draft", createdAt: time, updatedAt: time });
    buildProductKnowledgeFromSuperbuy(data, productId, fixture.source);
    const summary = productKnowledgeSummary(data, productId);
    for (const [fieldKey, expected] of Object.entries(fixture.expected) as [ProductKnowledgeFieldKey, ExpectedTruth][]) {
      const actual = productKnowledgeValue(data, productId, fieldKey);
      const field = summary.fields.find((entry) => entry.fieldKey === fieldKey);
      fieldResults.push({ fixtureId: fixture.id, fieldKey, expected, actual, correct: valueMatches(actual, expected), confidence: field?.confidence || 0 });
    }
  }
  const known = fieldResults.filter((result) => result.expected.expectation !== "unknown" && result.expected.expectation !== "not_present");
  const unknown = fieldResults.filter((result) => result.expected.expectation === "unknown" || result.expected.expectation === "not_present");
  const calibratedResults = fieldResults.filter((result) => result.expected.expectation !== "unknown" && result.expected.expectation !== "not_present");
  const confidenceBuckets = [
    { label: "90-100%", min: 0.9, max: 1 },
    { label: "75-89%", min: 0.75, max: 0.899 },
    { label: "50-74%", min: 0.5, max: 0.749 },
    { label: "Below 50%", min: 0, max: 0.499 },
  ].map((bucket) => {
    const results = calibratedResults.filter((result) => result.confidence >= bucket.min && result.confidence <= bucket.max);
    return { ...bucket, count: results.length, correctness: results.length ? Math.round(results.filter((result) => result.correct).length / results.length * 100) : 0 };
  });
  const byField = (fieldKey: ProductKnowledgeFieldKey) => {
    const results = fieldResults.filter((result) => result.fieldKey === fieldKey);
    return results.length ? Math.round(results.filter((result) => result.correct).length / results.length * 100) : 0;
  };
  return {
    fixtureCount: fixtures.length,
    fieldResultCount: fieldResults.length,
    exactOrAcceptableAccuracy: Math.round(known.filter((result) => result.correct).length / known.length * 100),
    missingFieldPrecision: unknown.length ? Math.round(unknown.filter((result) => result.correct).length / unknown.length * 100) : 100,
    falsePositiveRate: unknown.length ? Math.round(unknown.filter((result) => !result.correct).length / unknown.length * 100) : 0,
    variantPreservationAccuracy: byField("variant_options"),
    supplierCleanupAccuracy: byField("supplier_shop"),
    categoryMappingAccuracy: byField("universal_category"),
    materialNormalizationAccuracy: byField("material"),
    priceExtractionAccuracy: byField("price"),
    domesticShippingAccuracy: byField("domestic_shipping"),
    weightAccuracy: byField("weight"),
    stockAccuracy: byField("stock"),
    confidenceBuckets,
    failures: fieldResults.filter((result) => !result.correct),
    data,
  };
}
