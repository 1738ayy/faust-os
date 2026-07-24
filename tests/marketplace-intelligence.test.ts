import assert from "node:assert/strict";
import { test } from "node:test";
import type { Product, Variant } from "../domain/business";
import {
  MarketplaceEngine,
  buildMarketplaceKnowledgeGraph,
  diffMarketplaceProfiles,
  getMarketplaceProfile,
  listMarketplaceProfiles,
  marketplaceFixtureCoverage,
  marketplaceFixtureInputs,
  marketplaceProfiles,
  marketplaceSlugs,
  validateProfileForActivation,
  selectImagesForMarketplace,
  translateCategory,
  translateCondition,
  validateMarketplaceDraft,
} from "../lib/marketplace-intelligence";

const time = "2026-07-23T12:00:00.000Z";
const product: Product = {
  id: crypto.randomUUID(),
  title: "Vintage wash heavyweight hoodie with oversized streetwear fit",
  brand: "Faust Supply",
  category: "Streetwear",
  tags: ["hoodie", "streetwear"],
  image: "/hoodie-cover.png",
  images: ["/hoodie-cover.png", "/hoodie-detail.png"],
  description: "Heavyweight hoodie with a washed finish and clean streetwear silhouette.",
  status: "active",
  createdAt: time,
  updatedAt: time,
};
const variant: Variant = {
  id: crypto.randomUUID(),
  productId: product.id,
  sku: "FST-HOOD-001",
  title: "Charcoal / L",
  condition: "New with tags",
  landedUnitCost: 31.7,
  defaultSalePrice: 86,
  reorderPoint: 2,
  reorderQuantity: 8,
  active: true,
};

test("marketplace profiles are versioned capability records for every supported channel", () => {
  const profiles = listMarketplaceProfiles();
  assert.deepEqual(profiles.map((profile) => profile.marketplace), [...marketplaceSlugs]);
  for (const profile of profiles) {
    assert.equal(profile.status, "active");
    assert.match(profile.profileVersion, /^\d+\.\d+\.\d+$/);
    assert.ok(profile.requirements.required.includes("title"));
    assert.ok(profile.requirements.required.includes("price"));
    assert.ok(profile.requirements.required.includes("category"));
    assert.ok(profile.contentRules.titleMaxLength > 0);
    assert.ok(profile.imageRules.maxImages >= profile.imageRules.minImages);
    assert.ok(profile.operationalLimits.imageUploadConcurrency > 0);
    assert.ok(profile.riskRules.warnings.length > 0);
    assert.deepEqual(validateProfileForActivation(profile), []);
  }
});

test("marketplace knowledge graph connects universal fields to marketplace behavior", () => {
  const graph = buildMarketplaceKnowledgeGraph();
  assert.ok(graph.nodes.some((node) => node.id === "universal:title"));
  assert.ok(graph.edges.some((edge) => edge.from === "universal:condition" && edge.marketplace === "Depop" && edge.relationship === "maps_to"));
  assert.ok(graph.edges.some((edge) => edge.from === "category:jewelry.necklaces" && edge.marketplace === "eBay"));
  assert.ok(graph.edges.some((edge) => edge.from === "sync:inventory" && edge.marketplace === "Mercari" && edge.relationship === "syncs"));
});

test("engine translates categories and conditions without leaking marketplace logic into callers", () => {
  assert.equal(translateCategory("Necklace", "Depop"), "Accessories > Jewelry");
  assert.equal(translateCategory("Necklace", "eBay"), "Jewelry & Watches > Fashion Jewelry > Necklaces & Pendants");
  assert.equal(translateCondition("Excellent", "Mercari"), "Like New");
  assert.equal(translateCondition("New with tags", "Poshmark"), "NWT");
});

test("engine generates valid channel drafts for fixture products across all marketplaces", () => {
  for (const profile of listMarketplaceProfiles()) {
    const draft = MarketplaceEngine.generateDraft({
      product,
      variant,
      physicalSku: "PHY-HOOD-L",
      quantity: 2,
      imageUrls: ["/hoodie-cover.png", "/hoodie-detail.png"],
    }, profile.displayName);
    assert.equal(draft.marketplace, profile.displayName);
    assert.equal(draft.profileVersion, profile.profileVersion);
    assert.ok(draft.title.length <= profile.contentRules.titleMaxLength);
    assert.ok(draft.description.includes("Physical SKU: PHY-HOOD-L"));
    assert.ok(draft.category.length > 0);
    assert.equal(draft.attributes.condition, translateCondition(variant.condition, profile.marketplace));
    assert.ok(draft.generatedFields.some((field) => field.fieldKey === "category" && field.sourcePath === "identity.categoryId"));
    assert.ok(draft.readiness.score >= 0);
    assert.deepEqual(draft.validationErrors, []);
  }
});

test("image intelligence trims marketplace image sets with an explicit warning", () => {
  const manyImages = Array.from({ length: 20 }, (_, index) => `/image-${index}.png`);
  const { selected, warnings } = selectImagesForMarketplace(manyImages, "depop");
  assert.equal(selected.length, getMarketplaceProfile("depop").imageRules.maxImages);
  assert.match(warnings[0], /held back/);
});

test("draft validation follows the profile limit for each marketplace", () => {
  const errors = validateMarketplaceDraft({
    marketplace: "Depop",
    title: "x".repeat(getMarketplaceProfile("Depop").contentRules.titleMaxLength + 1),
    description: "Too short",
    price: 0,
    category: "",
    imageUrls: [],
    physicalSku: "",
    attributes: {},
  });
  assert.ok(errors.some((error) => error.includes("Depop title")));
  assert.ok(errors.some((error) => error.includes("Price must be")));
  assert.ok(errors.some((error) => error.includes("Category")));
  assert.ok(errors.some((error) => error.includes("image")));
  assert.ok(errors.some((error) => error.includes("Physical SKU")));
});

test("profile change detection reports operational marketplace rule changes", () => {
  const previous = marketplaceProfiles.depop;
  const next = {
    ...previous,
    profileVersion: "2.5.0",
    contentRules: { ...previous.contentRules, titleMaxLength: 120 },
    imageRules: { ...previous.imageRules, maxImages: 10 },
  };
  const changes = diffMarketplaceProfiles(previous, next);
  assert.ok(changes.some((change) => change.field === "profileVersion"));
  assert.ok(changes.some((change) => change.field === "contentRules.titleMaxLength" && change.severity === "warning"));
  assert.ok(changes.some((change) => change.field === "imageRules.maxImages"));
});

test("fixture harness exercises every marketplace across generation, validation, readiness, and image selection", () => {
  const coverage = marketplaceFixtureCoverage();
  assert.equal(coverage.marketplaces, 5);
  assert.equal(coverage.fixtures, 17);
  assert.equal(coverage.generationScenarios, 85);
  assert.equal(coverage.validationScenarios, 85);
  let generated = 0, validated = 0, readiness = 0;
  for (const fixtureCase of marketplaceFixtureInputs()) {
    for (const profile of listMarketplaceProfiles()) {
      const draft = MarketplaceEngine.generateDraft(fixtureCase.input, profile.displayName);
      generated += 1;
      assert.equal(draft.marketplace, profile.displayName);
      assert.ok(draft.generatedFields.length >= 7);
      assert.ok(draft.generatedFields.every((field) => field.source));
      assert.ok(draft.imageUrls.length <= profile.imageRules.maxImages);
      assert.ok(draft.readiness.state);
      readiness += 1;
      validateMarketplaceDraft({ marketplace: profile.displayName, title: draft.title, description: draft.description, price: draft.price, category: draft.category, imageUrls: draft.imageUrls, physicalSku: fixtureCase.input.physicalSku, attributes: draft.attributes });
      validated += 1;
    }
  }
  assert.equal(generated, 85);
  assert.equal(validated, 85);
  assert.equal(readiness, 85);
});

test("draft inspector exposes universal input, provenance, defaults, validation, readiness, and payload preview", () => {
  const inspected = MarketplaceEngine.inspectDraft({ product, variant, physicalSku: "PHY-HOOD-L", quantity: 2, imageUrls: ["/hoodie-cover.png", "/hoodie-detail.png"] }, "Depop");
  assert.equal(inspected.profileVersion, getMarketplaceProfile("Depop").profileVersion);
  assert.equal(inspected.universalInput.commerce.sku, "PHY-HOOD-L");
  assert.ok(inspected.mappingSources.some((field) => field.fieldKey === "shippingService" && field.source === "marketplace_default"));
  assert.ok(inspected.connectorPayloadPreview.title);
  assert.ok(inspected.readinessResult.score >= 0);
});
