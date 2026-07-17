import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import vm from "node:vm";

type MockElement = {
  textContent?: string;
  href?: string;
  getAttribute?: (name: string) => string | null;
};

test("Superbuy extractor ignores disclaimer overlays and modal controls", () => {
  const script = readFileSync(join(process.cwd(), "extension", "extractors", "product.js"), "utf8");
  const window: { FaustExtractProduct?: () => { title: string; supplier: string; storeName: string; images: string[]; variants: { name: string }[] } } = {};
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
      { textContent: "OK" },
      { textContent: "Got It" },
      { textContent: "I have read and agree" },
      { textContent: "Black / L" },
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
