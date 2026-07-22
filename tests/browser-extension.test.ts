import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import type { OperatingData } from "../domain/business";
import { analyzeExtensionProduct, applyExtensionAction, extensionConnectionSummary, hashExtensionToken, importExtensionProduct, marketplaceFormMapping } from "../lib/browser-extension";
import { adapterHealth, marketplaceAdapters } from "../lib/extension-adapters";
import { extensionActionSchema } from "../lib/validation/requests";

const sourceProduct = {
  source: "1688",
  importedAt: "2026-07-01T00:00:00.000Z",
  title: "1688 Heavyweight Hoodie",
  superbuyUrl: "https://detail.1688.com/offer/123.html",
  supplier: "Hangzhou Factory",
  storeName: "Hangzhou Factory Store",
  images: ["https://img.example.test/hoodie.jpg"],
  variants: [{ id: "black-l", name: "Black / L", options: ["Black", "L"], price: 118 }],
  price: 118,
  domesticShipping: 12,
  minimumOrderQuantity: 3,
  weight: "650g",
  sellerRating: 4.8,
  salesCount: 1200,
  pageTimestamp: "2026-07-01T00:00:00.000Z",
};

const fixture = (): OperatingData => ({ version: 1, mode: "local", updatedAt: "2026-07-01T00:00:00.000Z", products: [], variants: [], locations: [], balances: [], stockMovements: [], suppliers: [], purchaseOrders: [], parcels: [], listings: [], customers: [], orders: [], transactions: [], tasks: [], notices: [], insights: [], activity: [], purchaseBatches: [], landedCostComponents: [], marketplaceAccounts: [], listingTemplates: [], channelListingDrafts: [], listingSyncJobs: [], listingReviewItems: [], physicalSkuMappings: [], outboxEvents: [], durableJobs: [], deadLetters: [], channelSyncStates: [], inventoryRiskLocks: [], extensionDevices: [], extensionSessions: [], extensionArtifacts: [], extensionActionAudits: [] });

test("extension parser and profitability calculate landed economics", () => {
  const analysis = analyzeExtensionProduct(sourceProduct, { rmbUsdRate: 0.14, quantity: 3, targetSalePriceUsd: 65 });
  assert.equal(analysis.product.source, "1688");
  assert.equal(analysis.purchaseCostUsd, 16.52);
  assert.ok(analysis.landedUnitCost > analysis.purchaseCostUsd);
  assert.equal(analysis.byMarketplace.length, 5);
  assert.ok(analysis.byMarketplace.find((entry) => entry.marketplace === "Depop")?.expectedProfit);
});

test("extension scan intake persists the latest source scan for the web analyzer", () => {
  const data = fixture();
  const result = applyExtensionAction(data, { action: "scan-intake", payload: sourceProduct }) as { product: typeof sourceProduct };
  assert.equal(result.product.title, sourceProduct.title);
  const latestScan = data.extensionArtifacts?.find((artifact) => artifact.metadata.kind === "latest_source_scan");
  assert.ok(latestScan);
  assert.deepEqual(latestScan.metadata.product, result.product);
  assert.ok(data.activity.some((entry) => entry.action === "Extension product scanned"));
  assert.ok(data.extensionActionAudits?.some((entry) => entry.action === "scan-intake" && entry.status === "succeeded"));
});

test("extension import is approved, idempotent, and creates five channel drafts", () => {
  const data = fixture();
  assert.throws(() => applyExtensionAction(data, { action: "import-product", product: sourceProduct, approved: false }), /approved/);
  const result = importExtensionProduct(data, sourceProduct, { rmbUsdRate: 0.14, quantity: 3 }, "import-once");
  assert.equal(result.idempotent, false);
  assert.equal(data.suppliers.length, 1);
  assert.equal(data.variants.length, 1);
  assert.equal(data.purchaseBatches?.length, 1);
  assert.ok(data.purchaseBatches?.[0].updatedAt);
  assert.equal(data.channelListingDrafts?.length, 5);
  data.channelListingDrafts = [];
  data.listings = [];
  data.physicalSkuMappings = [];
  data.outboxEvents = [];
  data.durableJobs = [];
  data.listingSyncJobs = [];
  const second = importExtensionProduct(data, sourceProduct, { rmbUsdRate: 0.14, quantity: 3 }, "import-once");
  assert.equal(second.idempotent, true);
  assert.equal(second.drafts.length, 5);
  assert.equal(data.channelListingDrafts?.length, 5);
  assert.equal(data.outboxEvents?.length, 5);
  assert.ok(data.outboxEvents?.every((event) => event.updatedAt));
  assert.equal(new Set(data.outboxEvents?.map((event) => event.idempotencyKey)).size, 5);
  assert.ok(data.outboxEvents?.every((event) => /^[0-9a-f-]{36}$/.test(event.idempotencyKey || "")));
  assert.equal(data.products.length, 1);
});

test("sequential extension imports create independent catalog products without stale identity reuse", () => {
  const data = fixture();
  const products = ["Radiohead Tee", "Affliction Tee", "JNCO Shorts"].map((title, index) => ({
    ...sourceProduct,
    title,
    superbuyUrl: `https://www.superbuy.com/en/page/buy/?url=${encodeURIComponent(`https://detail.1688.com/offer/catalog-${index + 1}.html`)}`,
    original1688Url: `https://detail.1688.com/offer/catalog-${index + 1}.html`,
    images: [`https://img.example.test/catalog-${index + 1}.jpg`],
    variants: [{ id: `catalog-${index + 1}-black`, name: `${title} / Black`, options: ["Black"], price: 20 + index, stock: 10 }],
    price: 20 + index,
  }));

  const imported = products.map((product, index) => importExtensionProduct(data, product, { rmbUsdRate: 0.14, quantity: 1 }, `catalog-import-${index + 1}`));
  assert.equal(data.products.length, 3);
  assert.deepEqual(data.products.map((product) => product.title), ["Radiohead Tee", "Affliction Tee", "JNCO Shorts"]);
  assert.equal(new Set(data.products.map((product) => product.id)).size, 3);
  assert.equal(new Set(data.products.map((product) => product.sourceUrl)).size, 3);
  assert.deepEqual(imported.map((result) => result.idempotent), [false, false, false]);
  assert.ok(data.products.every((product, index) => product.images?.includes(`https://img.example.test/catalog-${index + 1}.jpg`)));

  const repeat = importExtensionProduct(data, { ...products[1], superbuyUrl: "https://detail.1688.com/offer/catalog-2.html?spm=tracking" }, { rmbUsdRate: 0.14, quantity: 1 }, "catalog-import-2-repeat");
  assert.equal(repeat.idempotent, true);
  assert.equal(repeat.productId, imported[1].productId);
  assert.equal(data.products.length, 3);
});

test("extension import preserves every scanned color row as a Faust SKU variant", () => {
  const data = fixture();
  const scanned = {
    ...sourceProduct,
    title: "Xijia Saturn chain necklace",
    superbuyUrl: "https://detail.1688.com/offer/982693242069.html",
    variantOptions: {
      colors: [
        "Copper inlaid zirconia pin necklace silver (high version + original buckle)",
        "Copper zirconia pin necklace gold (high version + original buckle)",
        "Alloy pin bracelet in gold",
      ],
    },
    variants: [
      { id: "variant-0", name: "Copper inlaid zirconia pin necklace silver (high version + original buckle)", options: ["Copper inlaid zirconia pin necklace silver (high version + original buckle)"], price: 1.59, stock: 3741 },
      { id: "variant-1", name: "Copper zirconia pin necklace gold (high version + original buckle)", options: ["Copper zirconia pin necklace gold (high version + original buckle)"], price: 1.59, stock: 9568 },
      { id: "variant-2", name: "Alloy pin bracelet in gold", options: ["Alloy pin bracelet in gold"], price: 0.63, stock: 9892 },
    ],
    price: 0.63,
    priceRange: { min: 0.63, max: 1.59 },
    weight: "10g",
  };
  const result = importExtensionProduct(data, scanned, { rmbUsdRate: 0.14, quantity: 1 }, "scan-import-all-variants");
  assert.equal(result.idempotent, false);
  assert.equal(data.products.length, 1);
  assert.equal(data.variants.length, 3);
  assert.equal(data.variants.map((variant) => variant.title).join("|"), scanned.variants.map((variant) => variant.name).join("|"));
  assert.equal(data.channelListingDrafts?.length, 15);
  assert.equal(result.drafts.length, 15);
  assert.ok(data.variants.every((variant) => variant.sku.startsWith("FST-")));
  assert.ok(data.activity.some((entry) => entry.detail.includes("3 scanned variant")));
});

test("extension import creates marketplace-safe draft titles for long 1688 products", () => {
  const data = fixture();
  const longTitleProduct = {
    ...sourceProduct,
    title: "Xijia NANA with the same pin Saturn chain necklace personality fashion, simple trend European and American design sweater chain",
  };
  importExtensionProduct(data, longTitleProduct, { rmbUsdRate: 0.14, quantity: 1 }, "long-title-import");
  const depop = data.channelListingDrafts?.find((draft) => draft.marketplace === "Depop");
  const poshmark = data.channelListingDrafts?.find((draft) => draft.marketplace === "Poshmark");
  assert.ok(depop);
  assert.ok(poshmark);
  assert.equal(depop.status, "validated");
  assert.equal(poshmark.status, "validated");
  assert.ok(depop.title.length <= 80);
  assert.ok(poshmark.title.length <= 80);
  assert.ok(depop.title.includes("..."));
  assert.ok(!depop.title.includes("…"));
  assert.match(depop.title, / - FST-/);
});

test("extension import repairs existing failed marketplace drafts", () => {
  const data = fixture();
  const longTitleProduct = {
    ...sourceProduct,
    title: "Xijia NANA with the same pin Saturn chain necklace personality fashion, simple trend European and American design sweater chain",
  };
  importExtensionProduct(data, longTitleProduct, { rmbUsdRate: 0.14, quantity: 1 }, "long-title-repair");
  for (const marketplace of ["Depop", "Poshmark"] as const) {
    const draft = data.channelListingDrafts?.find((entry) => entry.marketplace === marketplace);
    assert.ok(draft);
    draft.title = `${longTitleProduct.title} - ${draft.physicalSku}`;
    draft.status = "failed";
    draft.syncState = "failed";
    draft.validationErrors = [`${marketplace} title must be 80 characters or fewer.`];
    data.listingReviewItems?.push({ id: crypto.randomUUID(), channelDraftId: draft.id, marketplace, severity: "warning", reason: "validation_error", status: "open", detail: draft.validationErrors.join(" "), actionLabel: "Review listing", createdAt: "2026-07-01T00:00:00.000Z" });
  }
  const repaired = importExtensionProduct(data, longTitleProduct, { rmbUsdRate: 0.14, quantity: 1 }, "long-title-repair-second");
  assert.equal(repaired.idempotent, true);
  for (const marketplace of ["Depop", "Poshmark"] as const) {
    const draft = data.channelListingDrafts?.find((entry) => entry.marketplace === marketplace);
    assert.ok(draft);
    assert.equal(draft.status, "validated");
    assert.equal(draft.syncState, "pending");
    assert.ok(draft.title.length <= 80);
    assert.deepEqual(draft.validationErrors, []);
    assert.ok(data.listingReviewItems?.some((entry) => entry.channelDraftId === draft.id && entry.reason === "validation_error" && entry.status === "resolved"));
  }
});

test("extension messages validate and marketplace mapping exposes fillable fields", () => {
  const parsed = extensionActionSchema.parse({ action: "analyze", product: sourceProduct, assumptions: { rmbUsdRate: 0.14 } });
  assert.equal(parsed.action, "analyze");
  assert.throws(() => extensionActionSchema.parse({ action: "confirm-publish", draftId: crypto.randomUUID(), externalUrl: "not-url", externalListingId: "x" }));
  const data = fixture();
  importExtensionProduct(data, sourceProduct, { targetSalePriceUsd: 65 }, "mapping");
  const draft = data.channelListingDrafts![0];
  const mapping = marketplaceFormMapping(draft);
  assert.equal(mapping.title, draft.title);
  assert.equal(mapping.sku, draft.physicalSku);
  assert.ok(mapping.images.length);
  assert.equal(mapping.adapterVersion, marketplaceAdapters[draft.marketplace].version);
});

test("extension side panel exposes safe fill without publishing", () => {
  const html = readFileSync(join(process.cwd(), "extension", "sidepanel.html"), "utf8");
  const script = readFileSync(join(process.cwd(), "extension", "sidepanel.js"), "utf8");
  assert.match(html, /Fill form/);
  assert.match(html, /Import to Faust/);
  assert.match(script, /FAUST_GUIDED_PUBLISH/);
  assert.match(script, /FAUST_IMPORT_TO_ANALYZER/);
  assert.match(script, /guidedPublish\(false\)/);
  assert.doesNotMatch(script, /FAUST_CONFIRM_PUBLISH/);
  assert.doesNotMatch(script, /\.submit\(/);
  assert.doesNotMatch(script, /\.click\(/);
  assert.match(script, /Number\(draft\.quantity\) > 0/);
});

test("extension import opens the web analyzer instead of leaving the user in the extension", () => {
  const script = readFileSync(join(process.cwd(), "extension", "background.js"), "utf8");
  assert.match(script, /FAUST_IMPORT_TO_ANALYZER/);
  assert.match(script, /\/api\/extension\/scan/);
  assert.match(script, /\/api\/extension\/analyze/);
  assert.match(script, /opportunity-analyzer\?source=extension-import/);
  assert.match(script, /chrome\.tabs\.create/);
});

test("extension marketplace filler avoids pretending complex controls are filled", () => {
  const script = readFileSync(join(process.cwd(), "extension", "marketplace-content.js"), "utf8");
  assert.match(script, /isUsableControl/);
  assert.match(script, /setNativeValue/);
  assert.match(script, /setFrameValue/);
  assert.match(script, /InputEvent\("input"/);
  assert.match(script, /optional_value_missing/);
  assert.match(script, /interactive_control_requires_human_confirmation/);
  assert.doesNotMatch(script, /\.click\(/);
  assert.doesNotMatch(script, /\.submit\(/);
});

test("extension confirmation, sync, pause, delist, and failure reporting are auditable", () => {
  const data = fixture();
  importExtensionProduct(data, sourceProduct, { targetSalePriceUsd: 65 }, "confirm");
  const draft = data.channelListingDrafts![0];
  applyExtensionAction(data, { action: "create-publish-job", draftId: draft.id, idempotencyKey: crypto.randomUUID() });
  applyExtensionAction(data, { action: "confirm-publish", draftId: draft.id, externalListingId: "DEMO-EXT-1", externalUrl: "https://depop.com/products/demo-ext-1", finalTitle: "Final title", finalPrice: 66, evidence: { type: "publish_confirmation", currentUrl: "https://depop.com/products/demo-ext-1", metadata: { selector: "a[href*='/products/']" } } });
  assert.equal(data.channelListingDrafts![0].externalListingId, "DEMO-EXT-1");
  applyExtensionAction(data, { action: "sync-quantity", draftId: draft.id, quantity: 2 });
  applyExtensionAction(data, { action: "pause-draft", draftId: draft.id, reason: "Phase 1 sync test" });
  applyExtensionAction(data, { action: "delist-draft", draftId: draft.id, reason: "Phase 1 delist test" });
  const review = applyExtensionAction(data, { action: "report-error", draftId: draft.id, marketplace: draft.marketplace, reason: "Selector changed", classification: "permanent", artifact: { type: "dom_snapshot", currentUrl: "https://www.depop.com/products/create", failedSelector: "input[name='title']", pageVersion: "depop-2026.07.phase2", metadata: { dom: { hash: "abc123" } } } });
  assert.equal((review as { reason: string }).reason, "sync_failed");
  assert.equal(data.deadLetters?.length, 1);
  assert.equal(data.extensionArtifacts?.length, 2);
  assert.equal(data.channelListingDrafts![0].syncState, "risk_locked");
  assert.ok(data.activity.some((entry) => entry.action.includes("Extension")));
});

test("marketplace adapters are versioned and include resilient selectors", () => {
  const adapters = Object.values(marketplaceAdapters);
  assert.equal(adapters.length, 5);
  for (const adapter of adapters) {
    assert.match(adapter.version, /phase2/);
    assert.ok(adapter.supportedUrlPatterns.length);
    assert.ok(adapter.login.loggedInSelectors.length);
    assert.ok(adapter.login.loggedOutSelectors.length);
    assert.ok(adapter.fields.every((field) => field.primary.length && field.labels.length));
    assert.equal(adapterHealth(adapter).status, "healthy");
  }
});

test("extension device registration creates short-lived token records and connection summary", () => {
  const data = fixture();
  const result = applyExtensionAction(data, { action: "register-device", deviceName: "CI extension", browser: "Chromium", environment: "local", version: "1.1.0-phase2", permissions: ["storage", "tabs"] }) as { deviceId: string; token: string };
  assert.match(result.deviceId, /^[0-9a-f-]{36}$/);
  assert.equal(data.extensionDevices?.[0].status, "active");
  assert.equal(data.extensionSessions?.[0].tokenHash, hashExtensionToken(result.token));
  assert.ok(new Date(data.extensionSessions![0].expiresAt).getTime() > Date.now());
  const summary = extensionConnectionSummary(data);
  assert.equal(summary.devices?.length, 1);
  assert.equal(summary.adapters.length, 5);
  applyExtensionAction(data, { action: "revoke-device", deviceId: result.deviceId, reason: "test revoke" });
  assert.equal(data.extensionDevices?.[0].status, "revoked");
  assert.ok(data.extensionSessions?.[0].revokedAt);
});
