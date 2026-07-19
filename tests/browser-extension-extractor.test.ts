import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import vm from "node:vm";

type MockElement = {
  textContent?: string;
  href?: string;
  parentElement?: { textContent?: string };
  closest?: (selector: string) => MockElement | null;
  getAttribute?: (name: string) => string | null;
};

test("Superbuy extractor ignores disclaimer overlays and modal controls", () => {
  const script = readFileSync(join(process.cwd(), "extension", "extractors", "product.js"), "utf8");
  const window: { FaustExtractProduct?: () => { title: string; supplier: string; storeName: string; images: string[]; variants: { name: string }[] } } = {};
  const option = (textContent: string, className = "sku-color-option"): MockElement => ({
    textContent,
    parentElement: { textContent: `Color ${textContent}` },
    closest: () => ({ textContent: `Color ${textContent}` }),
    getAttribute: (name) => name === "class" ? className : null,
  });
  const elements = {
    titleCandidates: [
      { textContent: "Click here to view the Superbuy 1688 Shopping Agent Service Disclaimer" },
      { textContent: "Hip-hop shell bead necklace handmade jewelry" },
    ],
    supplierCandidates: [
      { textContent: "English/ USD" },
      { textContent: "Hangzhou Jewelry Factory" },
    ],
    buttons: [
      option("OK"),
      option("Got It"),
      option("I have read and agree"),
      option("Black / L"),
    ],
    scripts: [] as MockElement[],
  };

  const document = {
    title: "Superbuy 1688 product page",
    body: {
      innerText: [
        "Click here to view the Superbuy 1688 Shopping Agent Service Disclaimer",
        "English/ USD",
        "Category: jewelry",
        "Stock: 9,390",
        "US $1.11",
        "Item Weight: 23g",
      ].join("\n"),
    },
    images: [
      { naturalWidth: 640, naturalHeight: 640, currentSrc: "https://cbu01.alicdn.com/img/ibank/product.jpg", src: "" },
      { naturalWidth: 300, naturalHeight: 300, currentSrc: "https://cdn.superbuy.com/QRCode_en.png", src: "" },
    ],
    links: [
      { href: "https://detail.1688.com/offer/982668006953.html", textContent: "" },
      { href: "https://www.superbuy.com/store/abc", textContent: "Hangzhou Jewelry Factory" },
    ],
    querySelector(selector: string) {
      if (selector.includes("description")) return { textContent: "Shell jewelry with Y2K styling" };
      return null;
    },
    querySelectorAll(selector: string) {
      if (selector.includes("application/ld+json")) return elements.scripts;
      if (selector.includes("button")) return elements.buttons;
      if (selector.includes("supplier") || selector.includes("seller") || selector.includes("store") || selector.includes("shop")) return elements.supplierCandidates;
      if (selector.includes("h1") || selector.includes("title") || selector.includes("product") || selector.includes("goods") || selector.includes("name")) return elements.titleCandidates;
      return [];
    },
  };

  vm.runInNewContext(script, {
    window,
    document,
    location: {
      hostname: "www.superbuy.com",
      href: "https://www.superbuy.com/en/page/buy/?url=https%3A%2F%2Fdetail.1688.com%2Foffer%2F982668006953.html",
      search: "?url=https%3A%2F%2Fdetail.1688.com%2Foffer%2F982668006953.html",
    },
    URLSearchParams,
    Set,
    Array,
    RegExp,
    JSON,
    Date,
    Number,
    String,
  });

  const product = window.FaustExtractProduct?.();
  assert.equal(product?.title, "Hip-hop shell bead necklace handmade jewelry");
  assert.equal(product?.supplier, "Hangzhou Jewelry Factory");
  assert.equal(product?.storeName, "Hangzhou Jewelry Factory");
  assert.equal(product?.images.length, 1);
  assert.equal(product?.images[0], "https://cbu01.alicdn.com/img/ibank/product.jpg");
  assert.equal(product?.variants.length, 1);
  assert.equal(product?.variants[0].name, "Black / L");
});

test("Superbuy extractor prefers product facts over navigation text", () => {
  const script = readFileSync(join(process.cwd(), "extension", "extractors", "product.js"), "utf8");
  const window: {
    FaustExtractProduct?: () => {
      title: string;
      supplier: string;
      category: string;
      price: number;
      domesticShipping: number;
      internationalShipping: number;
      internationalShippingEstimateSource: string;
      weight: string;
      variantOptions: { colors: string[]; sizes: string[] };
      variants: { name: string; options: string[] }[];
    };
  } = {};
  const option = (textContent: string): MockElement => ({
    textContent,
    parentElement: { textContent: `Color ${textContent}` },
    closest: () => ({ textContent: `Color ${textContent}` }),
    getAttribute: (name) => name === "class" ? "product-color sku-item" : null,
  });
  const elements = {
    titleCandidates: [{ textContent: "Heavyweight oversized blank T-shirt" }],
    supplierCandidates: [
      { textContent: "Shopping AssistantShipping Calculator >Forwarding >Parcel Tracking >Shopping Enquiry >" },
      { textContent: "Guangzhou Blank Apparel Co." },
    ],
    buttons: [
      option("Buy Now"),
      option("Add To Cart"),
      option("Washed black"),
      option("Bone white"),
    ],
    scripts: [] as MockElement[],
  };

  const document = {
    title: "Superbuy 1688 product page",
    body: {
      innerText: [
        "Shopping AssistantShipping Calculator >Forwarding >Parcel Tracking >Shopping Enquiry >",
        "Product Category",
        "T-shirt",
        "Store Name",
        "Guangzhou Blank Apparel Co.",
        "Domestic shipping: ¥12",
        "US $4.50",
        "Item Weight: 650g",
        "Color",
        "Washed black",
        "Bone white",
      ].join("\n"),
    },
    images: [],
    links: [{ href: "https://detail.1688.com/offer/123.html", textContent: "" }],
    querySelector(selector: string) {
      if (selector.includes("description")) return { textContent: "Blank heavyweight streetwear tee" };
      return null;
    },
    querySelectorAll(selector: string) {
      if (selector.includes("application/ld+json")) return elements.scripts;
      if (selector.includes("button")) return elements.buttons;
      if (selector.includes("supplier") || selector.includes("seller") || selector.includes("store") || selector.includes("shop")) return elements.supplierCandidates;
      if (selector.includes("h1") || selector.includes("title") || selector.includes("product") || selector.includes("goods") || selector.includes("name")) return elements.titleCandidates;
      return [];
    },
  };

  vm.runInNewContext(script, {
    window,
    document,
    location: {
      hostname: "www.superbuy.com",
      href: "https://www.superbuy.com/en/page/buy/?url=https%3A%2F%2Fdetail.1688.com%2Foffer%2F123.html",
      search: "?url=https%3A%2F%2Fdetail.1688.com%2Foffer%2F123.html",
    },
    URLSearchParams,
    Set,
    Array,
    RegExp,
    JSON,
    Date,
    Number,
    String,
  });

  const product = window.FaustExtractProduct?.();
  assert.equal(product?.title, "Heavyweight oversized blank T-shirt");
  assert.equal(product?.supplier, "Guangzhou Blank Apparel Co.");
  assert.equal(product?.category, "T-shirt");
  assert.equal(product?.price, 4.5);
  assert.equal(product?.domesticShipping, 12);
  assert.equal(product?.weight, "650g");
  assert.equal(product?.internationalShipping, 5.2);
  assert.match(product?.internationalShippingEstimateSource || "", /650g/);
  assert.equal(product?.variants.map((variant) => variant.name).join("|"), "Washed black|Bone white");
});

test("Superbuy extractor trims shop-card ratings and preserves option and size groups", () => {
  const script = readFileSync(join(process.cwd(), "extension", "extractors", "product.js"), "utf8");
  const window: {
    FaustExtractProduct?: () => {
      supplier: string;
      storeName: string;
      variantOptions: { colors: string[]; sizes: string[] };
      variants: { name: string; options: string[] }[];
    };
  } = {};

  const document = {
    title: "Superbuy 1688 product page",
    body: {
      innerText: [
        "SHOPVisit StoreShangrao Nanxi Clothing Co., Ltd3.7OverallDescription3.0Service4.5Logistics3.",
        "Product Category",
        "T-shirt",
        "US $6.00",
        "Item Weight: 500g",
        "Color",
        "Black",
        "White",
        "Washed gray",
        "Size",
        "S",
        "M",
        "L",
        "XL",
      ].join("\n"),
    },
    images: [],
    links: [{ href: "https://detail.1688.com/offer/456.html", textContent: "" }],
    querySelector() {
      return null;
    },
    querySelectorAll(selector: string) {
      if (selector.includes("application/ld+json")) return [];
      if (selector.includes("supplier") || selector.includes("seller") || selector.includes("store") || selector.includes("shop")) {
        return [{ textContent: "SHOPVisit StoreShangrao Nanxi Clothing Co., Ltd3.7OverallDescription3.0Service4.5Logistics3." }];
      }
      if (selector.includes("h1") || selector.includes("title") || selector.includes("product") || selector.includes("goods") || selector.includes("name")) {
        return [{ textContent: "Blank boxy fit T-shirt" }];
      }
      return [];
    },
  };

  vm.runInNewContext(script, {
    window,
    document,
    location: {
      hostname: "www.superbuy.com",
      href: "https://www.superbuy.com/en/page/buy/?url=https%3A%2F%2Fdetail.1688.com%2Foffer%2F456.html",
      search: "?url=https%3A%2F%2Fdetail.1688.com%2Foffer%2F456.html",
    },
    URLSearchParams,
    Set,
    Array,
    RegExp,
    JSON,
    Date,
    Number,
    String,
  });

  const product = window.FaustExtractProduct?.();
  assert.equal(product?.supplier, "Shangrao Nanxi Clothing Co., Ltd");
  assert.equal(product?.storeName, "Shangrao Nanxi Clothing Co., Ltd");
  assert.equal(product?.variantOptions.colors.join("|"), "Black|White|Washed gray");
  assert.equal(product?.variantOptions.sizes.join("|"), "S|M|L|XL");
  assert.equal(product?.variants.length, 3);
  assert.equal(product?.variants[0].options.join("|"), "Black|S|M|L|XL");
});

test("Superbuy extractor treats Color rows as priced purchasable variants", () => {
  const script = readFileSync(join(process.cwd(), "extension", "extractors", "product.js"), "utf8");
  const window: {
    FaustExtractProduct?: () => {
      title: string;
      priceRange?: { min: number; max: number };
      variantOptions: { colors: string[] };
      variants: { name: string; price?: number; stock?: number }[];
    };
  } = {};

  const document = {
    title: "Superbuy 1688 product page",
    body: {
      innerText: [
        "Xijia NANA with the same pin Saturn chain necklace personality fashion, simple trend European and American design sweater chain",
        "US $0.63 ~ US $1.59",
        "Excluding International Shipping Fee",
        "Color",
        "common-img",
        "Copper inlaid zirconia pin necklace silver (high version + original buckle)",
        "US $",
        "1.59",
        "Stock: 3741 items",
        "0",
        "common-img",
        "Copper zirconia pin necklace gold (high version + original buckle)",
        "US $",
        "1.59",
        "Stock: 9568 items",
        "0",
        "common-img",
        "Copper inlaid zirconia pin bracelet silver (high version + original buckle)",
        "US $",
        "1.43",
        "Stock: 9517 items",
        "0",
        "common-img",
        "Alloy pin bracelet in gold",
        "US $",
        "0.63",
        "Stock: 9892 items",
        "0",
        "Product Details",
      ].join("\n"),
    },
    images: [],
    links: [{ href: "https://detail.1688.com/offer/982693242069.html", textContent: "" }],
    querySelector() {
      return null;
    },
    querySelectorAll(selector: string) {
      if (selector.includes("application/ld+json")) return [];
      if (selector.includes("h1") || selector.includes("title") || selector.includes("product") || selector.includes("goods") || selector.includes("name")) {
        return [{ textContent: "Xijia NANA with the same pin Saturn chain necklace personality fashion, simple trend European and American design sweater chain" }];
      }
      return [];
    },
  };

  vm.runInNewContext(script, {
    window,
    document,
    location: {
      hostname: "www.superbuy.com",
      href: "https://www.superbuy.com/en/page/buy/?url=https%3A%2F%2Fdetail.1688.com%2Foffer%2F982693242069.html",
      search: "?url=https%3A%2F%2Fdetail.1688.com%2Foffer%2F982693242069.html",
    },
    URLSearchParams,
    Set,
    Array,
    RegExp,
    JSON,
    Date,
    Number,
    String,
  });

  const product = window.FaustExtractProduct?.();
  assert.equal(product?.variantOptions.colors.length, 4);
  assert.equal(product?.variants.length, 4);
  assert.equal(product?.variants[0].name, "Copper inlaid zirconia pin necklace silver (high version + original buckle)");
  assert.equal(product?.variants[0].price, 1.59);
  assert.equal(product?.variants[0].stock, 3741);
  assert.equal(product?.variants[3].name, "Alloy pin bracelet in gold");
  assert.equal(product?.variants[3].price, 0.63);
  assert.equal(product?.variants[3].stock, 9892);
});
