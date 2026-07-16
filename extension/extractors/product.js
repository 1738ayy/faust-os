/* eslint-disable @typescript-eslint/no-unused-vars */
(() => {
  const text = () => document.body?.innerText ?? "";
  const normalize = (value) => value?.replace(/\s+/g, " ").trim() || "";

  function unique(values) {
    return [...new Set(values.filter(Boolean))];
  }

  function numberFrom(value) {
    const match = String(value ?? "").replace(/,/g, "").match(/\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : undefined;
  }

  function firstMatch(pattern) {
    return text().match(pattern)?.[1]?.trim() || "";
  }

  function productImages() {
    return unique([...document.images]
      .filter((image) => image.naturalWidth >= 240 && image.naturalHeight >= 240)
      .map((image) => image.currentSrc || image.src)
      .filter((url) => /^https?:\/\//.test(url))
      .filter((url) => !/(logo|icon|flag|avatar|banner|ad[_-]?|placeholder)/i.test(url)));
  }

  function jsonLdProduct() {
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const data = JSON.parse(script.textContent || "{}");
        const candidates = Array.isArray(data) ? data : [data, ...(data['@graph'] || [])];
        const product = candidates.find((item) => item?.['@type'] === 'Product' || item?.['@type']?.includes?.('Product'));
        if (product) return product;
      } catch (_) {
        // Ignore malformed JSON-LD; the page text fallback remains available.
      }
    }
    return null;
  }

  function getOriginal1688Url() {
    const encoded = new URLSearchParams(location.search).get("url");
    if (encoded) {
      try { return decodeURIComponent(encoded); } catch (_) { return encoded; }
    }
    const link = [...document.links].find((element) => /1688\.com/.test(element.href));
    return link?.href || "";
  }

  function extractVariants() {
    const labels = [...document.querySelectorAll("button, [role=button], label")]
      .map((element) => normalize(element.textContent))
      .filter((label) => label && label.length < 80 && !/^(add|buy|cart|share|favorite)/i.test(label));
    return unique(labels).slice(0, 30).map((name, index) => ({ id: `variant-${index}`, name, options: [] }));
  }

  window.FaustExtractProduct = function extractProduct() {
    const structured = jsonLdProduct();
    const pageText = text();
    const range = pageText.match(/US\s*\$\s*([\d,.]+)\s*(?:~|-|–)\s*US\s*\$\s*([\d,.]+)/i);
    const price = numberFrom(structured?.offers?.price) ?? numberFrom(firstMatch(/US\s*\$\s*([\d,.]+)/i));
    const title = normalize(structured?.name) || normalize(document.querySelector("h1")?.textContent) || normalize(document.title.replace(/\s*[-|]\s*Superbuy.*$/i, ""));

    return {
      source: /1688\.com/i.test(location.hostname) ? "1688" : "superbuy",
      importedAt: new Date().toISOString(),
      title,
      superbuyUrl: location.href,
      original1688Url: getOriginal1688Url(),
      supplier: firstMatch(/(?:Supplier|Seller|Store)\s*:?\s*([^\n]+)/i),
      storeName: firstMatch(/(?:Visit Store|Store)\s*:?\s*([^\n]+)/i),
      supplierStoreUrl: [...document.links].find((element) => /store|shop/i.test(element.href) && element.href.includes("superbuy.com"))?.href || "",
      category: structured?.category || firstMatch(/Category\s*:?\s*([^\n]+)/i),
      description: normalize(structured?.description) || normalize(document.querySelector('[class*="description" i]')?.textContent),
      material: firstMatch(/Material\s*:?\s*([^\n]+)/i),
      dimensions: firstMatch(/(?:Dimensions?|Size)\s*:?\s*([^\n]+)/i),
      weight: firstMatch(/(?:Item )?Weight\s*:?\s*([\d.]+\s*(?:g|kg|lb|oz))/i),
      shippingWeight: firstMatch(/Shipping Weight\s*:?\s*([\d.]+\s*(?:g|kg|lb|oz))/i),
      packageSize: firstMatch(/Package Size\s*:?\s*([^\n]+)/i),
      packageInfo: firstMatch(/Package(?: Information)?\s*:?\s*([^\n]+)/i),
      stock: numberFrom(firstMatch(/Stock\s*:?\s*([\d,]+)/i)),
      minimumOrderQuantity: numberFrom(firstMatch(/(?:MOQ|Minimum Order)\s*:?\s*([\d,]+)/i)),
      price,
      domesticShipping: numberFrom(firstMatch(/(?:Domestic|China)\s*(?:shipping|freight)\s*:?\s*(?:US\s*\$)?\s*([\d,.]+)/i)),
      internationalShipping: numberFrom(firstMatch(/(?:International|Overseas)\s*(?:shipping|freight)\s*:?\s*(?:US\s*\$)?\s*([\d,.]+)/i)),
      sellerRating: numberFrom(firstMatch(/(?:rating|score)\s*:?\s*([\d.]+)/i)),
      salesCount: numberFrom(firstMatch(/(?:sold|sales)\s*:?\s*([\d,]+)/i)),
      orderCount: numberFrom(firstMatch(/orders?\s*:?\s*([\d,]+)/i)),
      notes: "Captured by Faust Commerce Bridge. Review selector results before import.",
      pageTimestamp: new Date().toISOString(),
      priceRange: range ? { min: numberFrom(range[1]), max: numberFrom(range[2]) } : undefined,
      images: unique([...(structured?.image ? (Array.isArray(structured.image) ? structured.image : [structured.image]) : []), ...productImages()]),
      variants: extractVariants(),
    };
  };
})();
