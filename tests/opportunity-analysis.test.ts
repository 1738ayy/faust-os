import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeOpportunity } from "../lib/analyze-opportunity";
import { buildOpportunity } from "../lib/builder/opportunity";
import type { SuperbuyProduct } from "../types/superbuy-product";

const product = (): SuperbuyProduct => ({
  source: "superbuy",
  importedAt: "2026-07-01T12:00:00.000Z",
  title: "Imported product",
  superbuyUrl: "https://www.superbuy.com/en/page/buy/?url=https%3A%2F%2Fdetail.1688.com%2Foffer%2F1.html",
  original1688Url: "https://detail.1688.com/offer/1.html",
  supplier: "Source supplier",
  storeName: "Source supplier",
  category: "T-shirt",
  price: 10,
  domesticShipping: 2,
  internationalShipping: 3,
  images: ["https://example.test/product.jpg"],
  variants: [{ id: "variant-1", name: "Black / L", options: ["Black", "L"], price: 10, stock: 8 }],
});

test("opportunity analysis uses the global target margin for recommended pricing", () => {
  const lowMargin = buildOpportunity(product(), { targetMargin: 35, marketplaceId: "depop" });
  const highMargin = buildOpportunity(product(), { targetMargin: 70, marketplaceId: "depop" });
  const lowAnalysis = analyzeOpportunity(lowMargin, { targetMargin: 35 });
  const highAnalysis = analyzeOpportunity(highMargin, { targetMargin: 70 });

  assert.equal(lowAnalysis.targetMargin, 35);
  assert.equal(highAnalysis.targetMargin, 70);
  assert.ok(highAnalysis.recommendedPrice > lowAnalysis.recommendedPrice);
  assert.equal(highMargin.salePrice, Math.round(highAnalysis.recommendedPrice * 100) / 100);
});
