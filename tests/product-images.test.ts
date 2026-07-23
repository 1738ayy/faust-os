import assert from "node:assert/strict";
import { test } from "node:test";
import type { OperatingData, Product } from "../domain/business";
import { importExtensionProduct } from "../lib/browser-extension";
import { currentProductDigitalTwin, ensureProductImageOwnership, productCoverImage, productGallery, productImageRevision, setProductImages } from "../lib/product-images";

const time = "2026-07-21T00:00:00.000Z";
const ids = ["image-1", "image-2", "image-3", "image-4"];

function id() {
  return ids.shift() || crypto.randomUUID();
}

function fixture(): OperatingData {
  return { version: 1, mode: "local", products: [], productImages: [], variants: [], locations: [], balances: [], stockMovements: [], suppliers: [], purchaseOrders: [], parcels: [], listings: [], customers: [], orders: [], transactions: [], tasks: [], notices: [], insights: [], activity: [], updatedAt: time };
}

test("product images are first-class owned records and reject temporary browser URLs", () => {
  const data = fixture();
  const product: Product = { id: "product-1", title: "Photo product", category: "Accessories", tags: [], status: "draft", createdAt: time, updatedAt: time };
  data.products.push(product);

  setProductImages(data, product, ["blob:https://faust.invalid/temp", "data:image/jpeg;base64,AAAA", "https://cdn.example.test/one.jpg", "chrome-extension://abc/two.jpg", "/api/import-image?key=product-images/2026-07-22/uploaded.jpg", "/api/import-image?storageKey=product-images%2Fproducts%2Fbusiness-1%2F2026-07-22%2Fuploaded.png", "https://cdn.example.test/two.jpg", "https://cdn.example.test/one.jpg"], { now: time, id, sourceType: "supplier" });

  assert.deepEqual(product.images, ["https://cdn.example.test/one.jpg", "/api/import-image?key=product-images/2026-07-22/uploaded.jpg", "/api/import-image?storageKey=product-images%2Fproducts%2Fbusiness-1%2F2026-07-22%2Fuploaded.png", "https://cdn.example.test/two.jpg"]);
  assert.equal(product.image, "https://cdn.example.test/one.jpg");
  assert.equal(product.coverImageId, "image-1");
  assert.equal(data.productImages?.length, 4);
  assert.ok(data.productImages?.every((image) => !image.url.startsWith("data:image/") && !image.url.startsWith("blob:")));
  assert.equal(data.productImages?.[0].isCover, true);
  assert.equal(productCoverImage(data, product), "https://cdn.example.test/one.jpg");
});

test("owned image records hydrate product image caches after reload", () => {
  const data = fixture();
  data.products.push({ id: "product-2", title: "Reload product", category: "T-shirt", tags: [], status: "draft", createdAt: time, updatedAt: time });
  data.productImages = [
    { id: "image-b", productId: "product-2", url: "https://cdn.example.test/b.jpg", position: 1, isCover: false, createdAt: time },
    { id: "image-a", productId: "product-2", url: "https://cdn.example.test/a.jpg", position: 0, isCover: true, createdAt: time },
  ];

  ensureProductImageOwnership(data, { now: time, id });

  assert.deepEqual(productGallery(data, data.products[0]), ["https://cdn.example.test/a.jpg", "https://cdn.example.test/b.jpg"]);
  assert.deepEqual(data.products[0].images, ["https://cdn.example.test/a.jpg", "https://cdn.example.test/b.jpg"]);
  assert.equal(data.products[0].image, "https://cdn.example.test/a.jpg");
  assert.equal(data.products[0].coverImageId, "image-a");
});

test("reordering product images updates the canonical cover image id", () => {
  const data = fixture();
  const product: Product = { id: "product-cover-change", title: "Cover change", category: "T-shirt", tags: [], status: "draft", createdAt: time, updatedAt: time };
  data.products.push(product);

  setProductImages(data, product, ["https://cdn.example.test/front.jpg", "https://cdn.example.test/back.jpg"], { now: time, id, sourceType: "manual" });
  const originalCoverId = product.coverImageId;
  setProductImages(data, product, ["https://cdn.example.test/back.jpg", "https://cdn.example.test/front.jpg"], { now: time, id, sourceType: "manual" });

  assert.notEqual(product.coverImageId, originalCoverId);
  assert.equal(productCoverImage(data, product), "https://cdn.example.test/back.jpg");
  assert.equal(data.productImages?.filter((entry) => entry.productId === product.id && entry.isCover).length, 1);
});

test("updating one product image never changes another product cover or gallery", () => {
  const data = fixture();
  const productA: Product = { id: "product-a", title: "Product A", category: "T-shirt", tags: [], status: "draft", createdAt: time, updatedAt: time };
  const productB: Product = { id: "product-b", title: "Product B", category: "T-shirt", tags: [], status: "draft", createdAt: time, updatedAt: time };
  data.products.push(productA, productB);

  setProductImages(data, productA, ["https://cdn.example.test/a-cover.jpg", "https://cdn.example.test/a-back.jpg"], { now: time, id, sourceType: "manual" });
  setProductImages(data, productB, ["https://cdn.example.test/b-cover.jpg", "https://cdn.example.test/b-back.jpg"], { now: time, id, sourceType: "manual" });
  const productBCoverId = productB.coverImageId;
  const productBGallery = [...(productB.images || [])];

  setProductImages(data, productA, ["https://cdn.example.test/a-cover-v2.jpg", "https://cdn.example.test/a-back.jpg"], { now: "2026-07-23T12:00:00.000Z", id, sourceType: "crop" });
  ensureProductImageOwnership(data, { now: "2026-07-23T12:00:00.000Z", id });

  assert.equal(productCoverImage(data, productA), "https://cdn.example.test/a-cover-v2.jpg");
  assert.equal(productA.images?.[0], "https://cdn.example.test/a-cover-v2.jpg");
  assert.equal(productB.coverImageId, productBCoverId);
  assert.deepEqual(productB.images, productBGallery);
  assert.equal(productCoverImage(data, productB), "https://cdn.example.test/b-cover.jpg");
  assert.ok(data.productImages?.filter((entry) => entry.productId === productA.id).every((entry) => entry.url.includes("/a-")));
  assert.ok(data.productImages?.filter((entry) => entry.productId === productB.id).every((entry) => entry.url.includes("/b-")));
});

test("canonical cover cannot point at another product image", () => {
  const data = fixture();
  const productA: Product = { id: "product-cover-a", title: "Cover A", category: "T-shirt", tags: [], coverImageId: "image-b-cover", status: "draft", createdAt: time, updatedAt: time };
  const productB: Product = { id: "product-cover-b", title: "Cover B", category: "T-shirt", tags: [], coverImageId: "image-b-cover", status: "draft", createdAt: time, updatedAt: time };
  data.products.push(productA, productB);
  data.productImages = [
    { id: "image-a-cover", productId: productA.id, url: "https://cdn.example.test/a.jpg", position: 0, isCover: true, createdAt: time },
    { id: "image-b-cover", productId: productB.id, url: "https://cdn.example.test/b.jpg", position: 0, isCover: true, createdAt: time },
  ];

  ensureProductImageOwnership(data, { now: time, id });

  assert.equal(productA.coverImageId, "image-a-cover");
  assert.equal(productCoverImage(data, productA), "https://cdn.example.test/a.jpg");
  assert.equal(productB.coverImageId, "image-b-cover");
  assert.equal(productCoverImage(data, productB), "https://cdn.example.test/b.jpg");
});

test("large product galleries stay isolated across many products", () => {
  const data = fixture();
  for (let index = 1; index <= 20; index += 1) {
    const product: Product = { id: `bulk-product-${index}`, title: `Bulk Product ${index}`, category: "Accessories", tags: [], status: "draft", createdAt: time, updatedAt: time };
    data.products.push(product);
    setProductImages(data, product, [`https://cdn.example.test/product-${index}-cover.jpg`, `https://cdn.example.test/product-${index}-detail.jpg`], { now: time, id, sourceType: "manual" });
  }

  const first = data.products[0];
  setProductImages(data, first, ["https://cdn.example.test/product-1-cover-v2.jpg", "https://cdn.example.test/product-1-detail.jpg"], { now: "2026-07-23T12:00:00.000Z", id, sourceType: "crop" });
  ensureProductImageOwnership(data, { now: "2026-07-23T12:00:00.000Z", id });

  assert.equal(productCoverImage(data, first), "https://cdn.example.test/product-1-cover-v2.jpg");
  for (const product of data.products.slice(1)) {
    const number = product.id.replace("bulk-product-", "");
    assert.equal(productCoverImage(data, product), `https://cdn.example.test/product-${number}-cover.jpg`);
    assert.deepEqual(productGallery(data, product), [`https://cdn.example.test/product-${number}-cover.jpg`, `https://cdn.example.test/product-${number}-detail.jpg`]);
  }
});

test("image revisions remain stable unless cover order or content changes", () => {
  const data = fixture();
  const product: Product = { id: "product-revision", title: "Revision product", category: "T-shirt", tags: [], status: "draft", createdAt: time, updatedAt: time };
  data.products.push(product);

  setProductImages(data, product, ["https://cdn.example.test/front.jpg", "https://cdn.example.test/back.jpg"], { now: time, id, sourceType: "manual" });
  const front = data.productImages?.find((entry) => entry.url.endsWith("/front.jpg"));
  assert.equal(productImageRevision(front), time);

  ensureProductImageOwnership(data, { now: "2026-07-22T00:00:00.000Z", id });
  const stableFront = data.productImages?.find((entry) => entry.url.endsWith("/front.jpg"));
  assert.equal(productImageRevision(stableFront), time);

  setProductImages(data, product, ["https://cdn.example.test/cropped-front.jpg", "https://cdn.example.test/back.jpg"], { now: "2026-07-23T00:00:00.000Z", id, sourceType: "crop" });
  const cropped = data.productImages?.find((entry) => entry.url.endsWith("/cropped-front.jpg"));
  assert.equal(productImageRevision(cropped), "2026-07-23T00:00:00.000Z");
});

test("digital twin assets follow the canonical cover image id", () => {
  const data = fixture();
  const product: Product = { id: "product-twin", title: "Twin hoodie", category: "T-shirt", tags: [], coverImageId: "cover-current", status: "active", createdAt: time, updatedAt: time };
  data.products.push(product);
  data.variants.push({ id: "variant-twin", productId: product.id, sku: "TWIN-HOOD-001", title: "Black / L", condition: "New", landedUnitCost: 12, defaultSalePrice: 48, reorderPoint: 2, reorderQuantity: 8, active: true });
  data.productImages = [
    { id: "cover-current", productId: product.id, url: "https://cdn.example.test/cover-current.jpg", position: 0, isCover: true, sourceType: "supplier", createdAt: time, updatedAt: time },
    { id: "cover-old", productId: product.id, url: "https://cdn.example.test/cover-old.jpg", position: 1, isCover: false, sourceType: "supplier", createdAt: time, updatedAt: time },
  ];
  data.productDigitalTwins = [
    { id: "twin-old", productId: product.id, sourceImageId: "cover-old", sourceImageUrl: "https://cdn.example.test/cover-old.jpg", sourceImageRevision: time, transparentImageUrl: "/api/import-image?key=digital-twins/old.png", storageKey: "digital-twins/old.png", processingStatus: "ready", segmentationConfidence: 0.91, bounds: { x: 10, y: 20, width: 300, height: 400 }, sourceDimensions: { width: 800, height: 900 }, transparentDimensions: { width: 1024, height: 1024 }, generatedAt: time, processorVersion: "faust-canvas-segmentation-v1", failureCode: null, createdAt: time, updatedAt: "2026-07-21T00:00:00.000Z" },
    { id: "twin-current", productId: product.id, sourceImageId: "cover-current", sourceImageUrl: "https://cdn.example.test/cover-current.jpg", sourceImageRevision: time, transparentImageUrl: "/api/import-image?key=digital-twins/current.png", storageKey: "digital-twins/current.png", processingStatus: "ready", segmentationConfidence: 0.88, bounds: { x: 12, y: 30, width: 320, height: 420 }, sourceDimensions: { width: 800, height: 900 }, transparentDimensions: { width: 1024, height: 1024 }, generatedAt: time, processorVersion: "faust-canvas-segmentation-v1", failureCode: null, createdAt: time, updatedAt: "2026-07-20T00:00:00.000Z" },
  ];

  const twin = currentProductDigitalTwin(data, product, "faust-canvas-segmentation-v1");

  assert.equal(productCoverImage(data, product), "https://cdn.example.test/cover-current.jpg");
  assert.equal(twin?.id, "twin-current");
  assert.equal(twin?.transparentImageUrl, "/api/import-image?key=digital-twins/current.png");
  assert.equal(product.image, undefined);
});

test("digital twin ignores stale assets when the current cover revision changes", () => {
  const data = fixture();
  const product: Product = { id: "product-stale-revision", title: "Stale revision", category: "T-shirt", tags: [], coverImageId: "cover-current", status: "active", createdAt: time, updatedAt: time };
  data.products.push(product);
  data.productImages = [
    { id: "cover-current", productId: product.id, url: "https://cdn.example.test/cover-current.jpg", position: 0, isCover: true, sourceType: "supplier", createdAt: time, updatedAt: "2026-07-22T00:00:00.000Z" },
  ];
  data.productDigitalTwins = [
    { id: "twin-stale", productId: product.id, sourceImageId: "cover-current", sourceImageUrl: "https://cdn.example.test/cover-current.jpg", sourceImageRevision: time, transparentImageUrl: "/api/import-image?key=digital-twins/stale.png", storageKey: "digital-twins/stale.png", processingStatus: "ready", segmentationConfidence: 0.91, bounds: { x: 10, y: 20, width: 300, height: 400 }, generatedAt: time, processorVersion: "faust-canvas-segmentation-v1", failureCode: null, createdAt: time, updatedAt: "2026-07-21T00:00:00.000Z" },
  ];

  assert.equal(currentProductDigitalTwin(data, product, "faust-canvas-segmentation-v1"), undefined);
});

test("extension import persists product images and reuses them for five channel drafts", () => {
  const data = fixture();
  const result = importExtensionProduct(data, {
    source: "1688",
    importedAt: time,
    title: "Sequential import image product",
    superbuyUrl: "https://detail.1688.com/offer/555.html",
    supplier: "Image Factory",
    storeName: "Image Factory",
    category: "Jewelry",
    price: 3,
    images: ["https://cbu01.alicdn.com/img/import-cover.jpg", "https://cbu01.alicdn.com/img/import-detail.jpg"],
    variants: [{ id: "silver", name: "Silver", options: ["Silver"], price: 3, stock: 10 }],
  }, { targetSalePriceUsd: 25, quantity: 1 }, "image-import-test");

  const product = data.products.find((entry) => entry.id === result.productId);
  assert.ok(product);
  assert.deepEqual(product?.images, ["https://cbu01.alicdn.com/img/import-cover.jpg", "https://cbu01.alicdn.com/img/import-detail.jpg"]);
  assert.equal(product?.coverImageId, data.productImages?.find((entry) => entry.productId === product?.id && entry.isCover)?.id);
  assert.equal(data.productImages?.filter((entry) => entry.productId === product?.id).length, 2);
  assert.equal(result.drafts.length, 5);
  assert.ok(result.drafts.every((draft) => draft.imageUrls[0] === "https://cbu01.alicdn.com/img/import-cover.jpg"));
});
