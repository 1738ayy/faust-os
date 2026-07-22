import assert from "node:assert/strict";
import { test } from "node:test";
import type { OperatingData, Product } from "../domain/business";
import { importExtensionProduct } from "../lib/browser-extension";
import { ensureProductImageOwnership, productCoverImage, productGallery, setProductImages } from "../lib/product-images";

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

  setProductImages(data, product, ["blob:https://faust.invalid/temp", "https://cdn.example.test/one.jpg", "chrome-extension://abc/two.jpg", "https://cdn.example.test/two.jpg", "https://cdn.example.test/one.jpg"], { now: time, id, sourceType: "supplier" });

  assert.deepEqual(product.images, ["https://cdn.example.test/one.jpg", "https://cdn.example.test/two.jpg"]);
  assert.equal(product.image, "https://cdn.example.test/one.jpg");
  assert.equal(data.productImages?.length, 2);
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
  assert.equal(data.productImages?.filter((entry) => entry.productId === product?.id).length, 2);
  assert.equal(result.drafts.length, 5);
  assert.ok(result.drafts.every((draft) => draft.imageUrls[0] === "https://cbu01.alicdn.com/img/import-cover.jpg"));
});
