(() => {
  const INTERNATIONAL_FREIGHT_TO_US_PER_KG_USD = 8;
  const text = () => document.body?.innerText ?? "";
  const normalize = (value) => value?.replace(/\s+/g, " ").trim() || "";
  const overlayTextPattern = /superbuy 1688 shopping agent service disclaimer|click here to view|english\s*\/\s*usd|i have read and agree|got it|confirm|^ok$|^x$|shopping cart|qr\s*code|shopping assistant|shipping calculator|forwarding|parcel tracking|shopping enquiry/i;
  const controlTextPattern = /^(add to cart|add|buy now|buy|cart|share|favorite|visit store|customer service|contact seller|select all|copy link|preview fill|fill form|common-img)$/i;

  function unique(values) {
    return [...new Set(values.filter(Boolean))];
  }

  function numberFrom(value) {
    const match = String(value ?? "").replace(/,/g, "").match(/\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : undefined;
  }

  function cleanText(value) {
    const cleaned = normalize(value);
    if (!cleaned || overlayTextPattern.test(cleaned)) return "";
    return cleaned;
  }

  function textLines() {
    return text().split(/\n+/).map((line) => normalize(line)).filter(Boolean);
  }

  function valueAfterLabel(labelPattern, { maxLookahead = 3 } = {}) {
    const lines = textLines();
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const sameLine = line.match(new RegExp(`^\\s*${labelPattern.source}\\s*[:：]?\\s*(.+)$`, labelPattern.flags));
      if (sameLine?.[1] && cleanText(sameLine[1])) return cleanText(sameLine[1]);
      if (labelPattern.test(line)) {
        for (let offset = 1; offset <= maxLookahead; offset += 1) {
          const candidate = cleanText(lines[index + offset]);
          if (candidate && !labelPattern.test(candidate)) return candidate;
        }
      }
    }
    return "";
  }

  function isUsefulProductText(value, { minLength = 8, maxLength = 180 } = {}) {
    const cleaned = cleanText(value);
    if (!cleaned) return false;
    if (cleaned.length < minLength || cleaned.length > maxLength) return false;
    if (/^(info|material|category|product category|stock|price|length|width|height|volume|weight|color|colour|size|quantity)$/i.test(cleaned)) return false;
    if (controlTextPattern.test(cleaned)) return false;
    return true;
  }

  function cleanSupplierName(value) {
    let cleaned = cleanText(value);
    if (!cleaned) return "";
    cleaned = cleaned
      .replace(/^SHOP\s*/i, "")
      .replace(/^Visit Store\s*/i, "")
      .replace(/Visit Store/ig, " ")
      .replace(/\d+(?:\.\d+)?\s*(?:Overall|Description|Service|Logistics).*$/i, "")
      .replace(/OverallDescription.*$/i, "")
      .replace(/Description\s*\d+(?:\.\d+)?.*$/i, "")
      .replace(/Service\s*\d+(?:\.\d+)?.*$/i, "")
      .replace(/Logistics\s*\d+(?:\.\d+)?.*$/i, "")
      .trim();
    const companyMatch =
      cleaned.match(/([A-Z][A-Za-z\s.'’&,-]{2,}?Co\.?,?\s*Ltd\.?)/i) ||
      cleaned.match(/([A-Z][A-Za-z\s.'’&,-]{2,}?Co\.?)/i) ||
      cleaned.match(/([A-Z][A-Za-z\s.'’&,-]{2,}?(?:Company|Factory|Apparel|Clothing|Trading|Store|Shop|Studio|Supply))/i);
    if (companyMatch?.[1]) cleaned = companyMatch[1];
    return cleanText(cleaned.replace(/\s+/g, " ").trim());
  }

  function firstMatch(pattern) {
    return text().match(pattern)?.[1]?.trim() || "";
  }

  function firstCleanMatch(pattern) {
    return cleanText(firstMatch(pattern));
  }

  function firstNumberMatch(pattern) {
    return numberFrom(firstMatch(pattern));
  }

  function metaContent(selector) {
    return document.querySelector(selector)?.getAttribute("content") || "";
  }

  function productImages() {
    return unique([...document.images]
      .filter((image) => image.naturalWidth >= 240 && image.naturalHeight >= 240)
      .map((image) => image.currentSrc || image.src)
      .filter((url) => /^https?:\/\//.test(url))
      .filter((url) => !/(logo|icon|flag|avatar|banner|ad[_-]?|placeholder|qrcode|qr[_-]?code)/i.test(url)));
  }

  function jsonLdProduct() {
    for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const data = JSON.parse(script.textContent || "{}");
        const candidates = Array.isArray(data) ? data : [data, ...(data["@graph"] || [])];
        const product = candidates.find((item) => item?.["@type"] === "Product" || item?.["@type"]?.includes?.("Product"));
        if (product) return product;
      } catch {
        // Ignore malformed JSON-LD; the page text fallback remains available.
      }
    }
    return null;
  }

  function getOriginal1688Url() {
    const encoded = new URLSearchParams(location.search).get("url");
    if (encoded) {
      try { return decodeURIComponent(encoded); } catch { return encoded; }
    }
    const link = [...document.links].find((element) => /1688\.com/.test(element.href));
    return link?.href || "";
  }

  function parseWeightKg(value) {
    const match = String(value || "").replace(/,/g, "").match(/([\d.]+)\s*(kg|g|lb|lbs|oz)\b/i);
    if (!match) return 0;
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    if (!Number.isFinite(amount)) return 0;
    if (unit === "kg") return amount;
    if (unit === "g") return amount / 1000;
    if (unit === "lb" || unit === "lbs") return amount * 0.453592;
    if (unit === "oz") return amount * 0.0283495;
    return 0;
  }

  function estimatedFreightToUnitedStates(weightValue) {
    const kg = parseWeightKg(weightValue);
    return kg > 0 ? Math.round(kg * INTERNATIONAL_FREIGHT_TO_US_PER_KG_USD * 100) / 100 : undefined;
  }

  function labeledCategory(structured) {
    return (
      valueAfterLabel(/Product\s*Category/i) ||
      firstCleanMatch(/Product\s*Category\s*[:：]?\s*([^\n]+)/i) ||
      cleanText(structured?.category) ||
      valueAfterLabel(/Category/i) ||
      firstCleanMatch(/Category\s*[:：]?\s*([^\n]+)/i)
    );
  }

  function domesticShippingPrice() {
    return (
      firstNumberMatch(/(?:Domestic|China|Local)\s*(?:shipping|freight)\s*[:：]?\s*(?:US\s*\$|USD|RMB|CNY|CN¥|¥)?\s*([\d,.]+)/i) ??
      numberFrom(valueAfterLabel(/Domestic\s*(?:shipping|freight)/i)) ??
      numberFrom(valueAfterLabel(/China\s*(?:shipping|freight)/i)) ??
      numberFrom(valueAfterLabel(/Local\s*(?:shipping|freight)/i))
    );
  }

  function productPrice(structured) {
    const structuredPrice = numberFrom(structured?.offers?.price);
    if (structuredPrice !== undefined) return structuredPrice;
    const lines = textLines().filter((line) => !/(domestic|china|local|international|overseas|shipping|freight)/i.test(line));
    const line = lines.find((candidate) => /(?:US\s*\$|USD|RMB|CNY|CN¥|¥)\s*[\d,.]+/i.test(candidate));
    return numberFrom(line);
  }

  function labelGroupOptions(labelPattern, stopPattern) {
    const options = [];
    const lines = textLines();
    for (let index = 0; index < lines.length; index += 1) {
      if (!labelPattern.test(lines[index])) continue;
      for (let offset = 1; offset <= 30; offset += 1) {
        const candidate = cleanText(lines[index + offset]);
        if (!candidate) continue;
        if (stopPattern.test(candidate)) break;
        if (isUsefulProductText(candidate, { minLength: 1, maxLength: 80 }) && !controlTextPattern.test(candidate)) options.push(candidate);
      }
    }
    return unique(options);
  }

  function isVariantNoise(line) {
    const cleaned = cleanText(line);
    if (!cleaned) return true;
    if (controlTextPattern.test(cleaned)) return true;
    if (/^(US\s*\$|USD|RMB|CNY|CN¥|¥)$/i.test(cleaned)) return true;
    if (/^\d+(?:\.\d+)?$/.test(cleaned)) return true;
    if (/^Stock\s*:\s*[\d,]+\s*items?$/i.test(cleaned)) return true;
    if (/^(0|1|2|3|4|5|6|7|8|9)$/.test(cleaned)) return true;
    return false;
  }

  function variantPriceNear(lines, index) {
    for (let offset = 1; offset <= 5; offset += 1) {
      const line = lines[index + offset] || "";
      const joined = `${line} ${lines[index + offset + 1] || ""}`;
      const price = numberFrom(joined.match(/(?:US\s*\$|USD|RMB|CNY|CN¥|¥)\s*([\d,.]+)/i)?.[1] || "");
      if (price !== undefined) return price;
      if (/^(US\s*\$|USD|RMB|CNY|CN¥|¥)$/i.test(line) && numberFrom(lines[index + offset + 1]) !== undefined) return numberFrom(lines[index + offset + 1]);
    }
    return undefined;
  }

  function variantStockNear(lines, index) {
    for (let offset = 1; offset <= 7; offset += 1) {
      const stock = numberFrom((lines[index + offset] || "").match(/Stock\s*:\s*([\d,]+)/i)?.[1] || "");
      if (stock !== undefined) return stock;
    }
    return undefined;
  }

  function colorVariantRows() {
    const rows = [];
    const lines = textLines();
    const colorIndex = lines.findIndex((line) => /^(Color|Colour|Product Color)$/i.test(line));
    if (colorIndex < 0) return rows;
    for (let index = colorIndex + 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (/^(Size|Quantity|Product Details|Product Description|Material|Package|Shipping|Domestic Shipping|International Shipping|Add To Cart|Buy Now)$/i.test(line)) break;
      if (isVariantNoise(line)) continue;
      if (!isUsefulProductText(line, { minLength: 2, maxLength: 180 })) continue;
      rows.push({
        name: cleanText(line),
        price: variantPriceNear(lines, index),
        stock: variantStockNear(lines, index),
      });
    }
    const seen = new Set();
    return rows.filter((row) => {
      const key = row.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function extractVariantGroups() {
    const colorRows = colorVariantRows();
    const skuElements = [...document.querySelectorAll("button, [role=button], label, li, [class*='sku' i], [class*='spec' i], [class*='color' i], [class*='variant' i], [class*='size' i]")]
      .filter((element) => {
        const marker = `${element.getAttribute?.("class") || ""} ${element.getAttribute?.("aria-label") || ""} ${element.getAttribute?.("title") || ""}`;
        const parentMarker = `${element.parentElement?.textContent || ""} ${element.closest?.("[class*='sku' i], [class*='spec' i], [class*='color' i], [class*='variant' i], [class*='size' i]")?.textContent || ""}`;
        return /color|colour|sku|spec|variant|style|size|model/i.test(`${marker} ${parentMarker}`);
      });

    const rawElementOptions = skuElements
      .map((element) => cleanText(element.getAttribute?.("title") || element.getAttribute?.("aria-label") || element.textContent))
      .filter((label) => isUsefulProductText(label, { minLength: 1, maxLength: 80 }))
      .filter((label) => !controlTextPattern.test(label))
      .filter((label) => !/^(color|colour|style|sku|specification|variant|select color|size|select size)$/i.test(label));

    const colorLineOptions = labelGroupOptions(/(^|\b)(color|colour|product color|style|option|model)(\b|$)/i, /^(size|quantity|stock|price|domestic|shipping|freight|product category|material|weight)$/i);
    const sizeLineOptions = labelGroupOptions(/(^|\b)(size|product size)(\b|$)/i, /^(color|colour|style|option|quantity|stock|price|domestic|shipping|freight|product category|material|weight)$/i);

    const sizePattern = /^(xxs|xs|s|m|l|xl|xxl|xxxl|xxxxl|one size|os|\d+(?:\.\d+)?|\d+\s*(?:cm|in)|[a-z]{1,4})$/i;
    const sizes = unique([...rawElementOptions, ...sizeLineOptions])
      .filter((option) => sizePattern.test(option))
      .slice(0, 40);
    const colors = colorRows.length ? colorRows.map((row) => row.name) : unique([...rawElementOptions, ...colorLineOptions])
      .filter((option) => !sizePattern.test(option))
      .filter((option) => !/(product category|domestic|shipping|freight|material|weight|stock|quantity|price)$/i.test(option))
      .slice(0, 60);
    return { colors, sizes, colorRows };
  }

  function extractVariants() {
    const groups = extractVariantGroups();
    const names = groups.colors.length ? groups.colors : groups.sizes;
    if (groups.colorRows.length) {
      return {
        groups,
        variants: groups.colorRows.map((row, index) => ({ id: `variant-${index}`, name: row.name, options: groups.sizes.length ? [row.name, ...groups.sizes] : [row.name], price: row.price, stock: row.stock })),
      };
    }
    return {
      groups,
      variants: names.map((name, index) => ({ id: `variant-${index}`, name, options: groups.colors.length && groups.sizes.length ? [name, ...groups.sizes] : [name] })),
    };
  }

  function productTitle(structured) {
    const candidates = [
      structured?.name,
      metaContent('meta[property="og:title"]'),
      metaContent('meta[name="twitter:title"]'),
      ...[...document.querySelectorAll("h1, h2, [class*='title' i], [class*='product' i], [class*='goods' i], [class*='name' i]")]
        .map((element) => element.textContent),
      document.title.replace(/\s*[-|]\s*Superbuy.*$/i, ""),
    ];
    return cleanText(candidates.find((candidate) => isUsefulProductText(candidate)) || "");
  }

  function supplierName() {
    const candidates = [
      valueAfterLabel(/(?:Shop|Store|Supplier|Seller)\s*Name/i),
      valueAfterLabel(/(?:Supplier|Seller|Store|Shop)\b/i),
      firstCleanMatch(/(?:Supplier|Seller|Store|Shop)\b\s*(?:Name)?\s*[:：]?\s*([^\n]+)/i),
      ...[...document.querySelectorAll("[class*='supplier' i], [class*='seller' i], [class*='store' i], [class*='shop' i]")]
        .map((element) => element.textContent),
      ...[...document.links]
        .filter((element) => /store|shop|supplier|seller|member\.1688/i.test(`${element.href} ${element.textContent || ""}`))
        .map((element) => element.textContent),
    ];
    return cleanSupplierName(candidates.find((candidate) => {
      const cleaned = cleanSupplierName(candidate);
      if (!isUsefulProductText(cleaned, { minLength: 3, maxLength: 120 })) return false;
      if (/shopping assistant|shipping calculator|forwarding|parcel tracking|shopping enquiry|english\s*\/\s*usd/i.test(cleaned)) return false;
      return true;
    }) || "");
  }

  window.FaustExtractProduct = function extractProduct() {
    const structured = jsonLdProduct();
    const pageText = text();
    const range = pageText.match(/(?:US\s*\$|USD|RMB|CNY|CN¥|¥)\s*([\d,.]+)\s*(?:~|-|–)\s*(?:US\s*\$|USD|RMB|CNY|CN¥|¥)?\s*([\d,.]+)/i);
    const price = productPrice(structured);
    const title = productTitle(structured);
    const supplier = supplierName();
    const weight = firstCleanMatch(/(?:Item\s*)?Weight\s*[:：]?\s*([\d.]+\s*(?:g|kg|lb|lbs|oz))/i) || valueAfterLabel(/(?:Item\s*)?Weight/i);
    const shippingWeight = firstCleanMatch(/Shipping\s*Weight\s*[:：]?\s*([\d.]+\s*(?:g|kg|lb|lbs|oz))/i) || valueAfterLabel(/Shipping\s*Weight/i);
    const visibleInternationalFreight = firstNumberMatch(/(?:International|Overseas|United States|US)\s*(?:shipping|freight)\s*[:：]?\s*(?:US\s*\$|USD|RMB|CNY|CN¥|¥)?\s*([\d,.]+)/i);
    const estimatedInternationalFreight = estimatedFreightToUnitedStates(shippingWeight || weight);
    const variantExtraction = extractVariants();

    return {
      source: /1688\.com/i.test(location.hostname) ? "1688" : "superbuy",
      importedAt: new Date().toISOString(),
      title,
      superbuyUrl: location.href,
      original1688Url: getOriginal1688Url(),
      supplier,
      storeName: supplier || firstCleanMatch(/(?:Visit Store|Store)\s*:?\s*([^\n]+)/i),
      supplierStoreUrl: [...document.links].find((element) => /store|shop|member\.1688/i.test(element.href) && /superbuy\.com|1688\.com/i.test(element.href))?.href || "",
      category: labeledCategory(structured),
      description: cleanText(structured?.description) || cleanText(document.querySelector('[class*="description" i]')?.textContent),
      material: firstCleanMatch(/Material\s*:?\s*([^\n]+)/i) || valueAfterLabel(/Material/i),
      dimensions: firstCleanMatch(/(?:Dimensions?|Size)\s*:?\s*([^\n]+)/i),
      weight,
      shippingWeight,
      packageSize: firstCleanMatch(/Package Size\s*:?\s*([^\n]+)/i),
      packageInfo: firstCleanMatch(/Package(?: Information)?\s*:?\s*([^\n]+)/i),
      stock: numberFrom(firstMatch(/Stock\s*:?\s*([\d,]+)/i)),
      minimumOrderQuantity: numberFrom(firstMatch(/(?:MOQ|Minimum Order)\s*:?\s*([\d,]+)/i)),
      price,
      domesticShipping: domesticShippingPrice(),
      internationalShipping: visibleInternationalFreight ?? estimatedInternationalFreight,
      internationalShippingEstimateUsd: estimatedInternationalFreight,
      internationalShippingDestination: "United States",
      internationalShippingEstimateSource: estimatedInternationalFreight !== undefined ? `Estimated from ${shippingWeight || weight} at $${INTERNATIONAL_FREIGHT_TO_US_PER_KG_USD}/kg` : undefined,
      sellerRating: numberFrom(firstMatch(/(?:rating|score)\s*:?\s*([\d.]+)/i)),
      salesCount: numberFrom(firstMatch(/(?:sold|sales)\s*:?\s*([\d,]+)/i)),
      orderCount: numberFrom(firstMatch(/orders?\s*:?\s*([\d,]+)/i)),
      notes: "Captured by Faust Commerce Bridge. Review selector results before import.",
      pageTimestamp: new Date().toISOString(),
      priceRange: range ? { min: numberFrom(range[1]), max: numberFrom(range[2]) } : undefined,
      images: unique([...(structured?.image ? (Array.isArray(structured.image) ? structured.image : [structured.image]) : []), ...productImages()]),
      variantOptions: variantExtraction.groups,
      variants: variantExtraction.variants,
    };
  };
})();
