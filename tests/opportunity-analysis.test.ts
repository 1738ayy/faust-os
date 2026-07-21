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

test("marketplace fee profiles calculate Depop Boost and marketplace-specific selling costs", () => {
  const boosted = buildOpportunity(product(), { targetMargin: 35, marketplaceId: "depop", depopBoostEnabledByDefault: true, depopBoostRate: 12 });
  boosted.salePrice = 50;
  boosted.listing.shippingPrice = 5;
  const boostedAnalysis = analyzeOpportunity(boosted, { targetMargin: 35 });
  const unboosted = { ...boosted, feeAssumptions: { ...boosted.feeAssumptions!, overrides: { depop_boost: { enabled: false, rate: 0.12 } } } };
  const unboostedAnalysis = analyzeOpportunity(unboosted, { targetMargin: 35 });
  const ebay = buildOpportunity(product(), { targetMargin: 35, marketplaceId: "ebay" });
  ebay.salePrice = 50;
  ebay.listing.shippingPrice = 5;
  const ebayAnalysis = analyzeOpportunity(ebay, { targetMargin: 35 });

  assert.equal(boostedAnalysis.feeProfileVersion, "depop-us-2026-07");
  assert.ok(boostedAnalysis.feeEstimates.some((fee) => fee.label === "Depop Boost" && fee.enabled && fee.amount === 6));
  assert.equal(unboostedAnalysis.promotionFees, 0);
  assert.ok(unboostedAnalysis.netProfit > boostedAnalysis.netProfit);
  assert.ok(ebayAnalysis.feeEstimates.some((fee) => fee.label === "Final Value Fee"));
  assert.notEqual(ebayAnalysis.totalSellingCosts, boostedAnalysis.totalSellingCosts);
});

test("opportunity builder suggests an editable SKU and preserves analyzer images", () => {
  const opportunity = buildOpportunity({ ...product(), storeName: "Nanxi Clothing Co", category: "T-shirt", title: "Cross border wing pattern tee", images: ["https://example.test/cover.jpg", "data:image/png;base64,abc"] }, { marketplaceId: "depop" });

  assert.match(opportunity.product.sku || "", /^FST-T-SHIRT-NANXI-CLOTH/);
  opportunity.product.sku = "RH-TEE-BLK-M";
  opportunity.product.media.images = ["data:image/png;base64,cropped-cover", "https://example.test/detail.jpg"];

  assert.equal(opportunity.product.sku, "RH-TEE-BLK-M");
  assert.deepEqual(opportunity.product.media.images, ["data:image/png;base64,cropped-cover", "https://example.test/detail.jpg"]);
});
