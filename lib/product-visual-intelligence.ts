import type { OperatingData, ProductCoverRecommendation, ProductImageObservation, ProductImageQuality, ProductImageRecord, ProductImageReviewDecision, ProductKnowledgeField, ProductKnowledgeFieldKey } from "../domain/business";
import { inferUniversalCategoryId, universalCategoryLabels, universalCategoryProfiles, type UniversalCategoryId } from "./marketplace-intelligence/mappings";
import { applyProductKnowledgeDecision, productKnowledgeSummary } from "./product-knowledge";
import { productCoverRecord } from "./product-images";

const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
export const visualIntelligenceModelVersion = "faust-visual-deterministic-v1";

export type CategoryCandidate = {
  id: UniversalCategoryId;
  label: string;
  confidence: number;
  supportingEvidence: string[];
  conflictingEvidence: string[];
};

export function ensureVisualIntelligenceCollections(data: OperatingData) {
  data.productImageObservations ||= [];
  data.productImageQuality ||= [];
  data.productCoverRecommendations ||= [];
  data.productImageReviewDecisions ||= [];
}

function compact(value: unknown) {
  if (value === undefined || value === null) return "";
  return String(value).toLowerCase().replace(/[_-]/g, " ").replace(/\s+/g, " ").trim();
}

function filenameSignals(url: string) {
  const decoded = decodeURIComponent(url).toLowerCase();
  const last = decoded.split(/[/?#]/).filter(Boolean).pop() || decoded;
  return compact(last);
}

const colorAliases: Record<string, string> = {
  black: "Black",
  white: "White",
  blue: "Blue",
  navy: "Blue",
  "gray blue": "Gray Blue",
  grey: "Gray",
  gray: "Gray",
  red: "Red",
  burgundy: "Burgundy",
  brown: "Brown",
  apricot: "Beige",
  beige: "Beige",
  cream: "Cream",
  silver: "Silver",
  gold: "Gold",
  copper: "Copper",
  pink: "Pink",
  purple: "Purple",
};

function observation(productId: string, imageId: string, observationType: ProductImageObservation["observationType"], value: ProductImageObservation["value"], confidence: number, explanation: string, evidenceRef?: string): ProductImageObservation {
  return { id: id(), productId, imageId, observationType, value, confidence, explanation, evidenceRef, modelVersion: visualIntelligenceModelVersion, provider: "deterministic", createdAt: now(), region: null };
}

function scoreImage(image: ProductImageRecord): ProductImageQuality {
  const signal = filenameSignals(image.url);
  const isSizeChart = /size|chart|measurement|尺寸|尺码/.test(signal);
  const isDetail = /detail|close|fabric|tag|label|详情|细节/.test(signal);
  const isWatermarked = /watermark|logo|qr|qrcode|superbuy|tbvideo|淘宝/.test(signal);
  const isLowRes = /thumb|small|100x|120x|low/.test(signal);
  const isBusy = /collage|grid|model|lifestyle|floor|carpet|busy/.test(signal);
  const resolution = isLowRes ? 45 : 86;
  const productVisibility = isSizeChart ? 12 : isDetail ? 48 : isBusy ? 66 : 88;
  const backgroundDistraction = isBusy ? 72 : isWatermarked ? 52 : 18;
  const watermarkRisk = isWatermarked ? 82 : 8;
  const cropping = /crop|cut|partial/.test(signal) ? 42 : 86;
  const lighting = /dark/.test(signal) ? 58 : 82;
  const sharpness = isLowRes ? 48 : 82;
  const obstruction = /hand|model|obstruct/.test(signal) ? 46 : 8;
  const baseMarketplaceSuitability = Math.round((resolution + productVisibility + cropping + lighting + sharpness + (100 - backgroundDistraction) + (100 - watermarkRisk) + (100 - obstruction)) / 8);
  const marketplaceSuitability = isSizeChart ? Math.min(baseMarketplaceSuitability, 32) : isDetail ? Math.min(baseMarketplaceSuitability, 58) : baseMarketplaceSuitability;
  const role: ProductImageQuality["role"] = isSizeChart ? "size_chart" : isDetail ? "detail" : marketplaceSuitability < 50 ? "excluded" : image.isCover || marketplaceSuitability >= 78 ? "cover_candidate" : "gallery";
  const time = now();
  return { id: id(), productId: image.productId, imageId: image.id, sharpness, resolution, lighting, productVisibility, obstruction, cropping, backgroundDistraction, watermarkRisk, duplicateSimilarity: 0, marketplaceSuitability, role, explanation: role === "size_chart" ? "Likely a size chart; useful for reference but not as a cover." : role === "detail" ? "Likely a detail shot; keep for gallery context, not primary cover." : "Ranked by visibility, background, watermark risk, resolution, and marketplace crop suitability.", createdAt: time, updatedAt: time };
}

function normalizedImageKey(image: ProductImageRecord) {
  return filenameSignals(image.originalUrl || image.url)
    .replace(/\b(thumb|small|large|copy|duplicate|dup|front|back|detail|main|image|img)\b/g, "")
    .replace(/\d+x\d+/g, "")
    .replace(/\.(jpg|jpeg|png|webp|avif)$/g, "")
    .trim();
}

export function analyzeProductImages(data: OperatingData, productId: string) {
  ensureVisualIntelligenceCollections(data);
  const product = data.products.find((entry) => entry.id === productId);
  if (!product) throw new Error("Product not found.");
  const images = (data.productImages || []).filter((image) => image.productId === productId).sort((a, b) => a.position - b.position);
  data.productImageObservations = data.productImageObservations!.filter((entry) => entry.productId !== productId);
  data.productImageQuality = data.productImageQuality!.filter((entry) => entry.productId !== productId);
  data.productCoverRecommendations = data.productCoverRecommendations!.filter((entry) => entry.productId !== productId || entry.status === "approved" || entry.status === "overridden");

  const quality = images.map(scoreImage);
  const groups = new Map<string, ProductImageRecord[]>();
  for (const image of images) {
    const key = normalizedImageKey(image);
    groups.set(key, [...(groups.get(key) || []), image]);
  }
  for (const group of groups.values()) {
    if (group.length <= 1) continue;
    for (const duplicate of group) {
      const row = quality.find((entry) => entry.imageId === duplicate.id);
      if (row) {
        row.duplicateSimilarity = 96;
        row.role = row.role === "cover_candidate" ? "gallery" : row.role;
        row.marketplaceSuitability = Math.max(0, row.marketplaceSuitability - 18);
        row.explanation += " Near-duplicate image detected; keep the clearest representative.";
      }
    }
  }

  const observations: ProductImageObservation[] = [];
  for (const image of images) {
    const signal = `${filenameSignals(image.url)} ${image.altText || ""} ${image.purpose || ""}`;
    for (const [alias, color] of Object.entries(colorAliases)) {
      if (signal.includes(alias)) observations.push(observation(productId, image.id, "dominant_color", color, alias === color.toLowerCase() ? 0.78 : 0.7, `Image filename or alt text contains '${alias}', normalized to marketplace-friendly color '${color}'.`, image.url));
    }
    if (/stripe|striped/.test(signal)) observations.push(observation(productId, image.id, "pattern", "Striped", 0.72, "Visual filename/alt signal suggests a striped pattern.", image.url));
    if (/floral|flower/.test(signal)) observations.push(observation(productId, image.id, "pattern", "Floral", 0.72, "Visual filename/alt signal suggests a floral pattern.", image.url));
    if (/denim|jean/.test(signal)) observations.push(observation(productId, image.id, "visible_material", "appears denim-like", 0.74, "Image signal suggests a denim-like broad visual material; exact composition still requires supplier evidence or user confirmation.", image.url));
    if (/metal|silver|gold|chain|hardware|buckle/.test(signal)) observations.push(observation(productId, image.id, "visible_material", "metallic hardware visible", 0.68, "Image signal suggests metal or hardware is visible; exact metal type is not inferred.", image.url));
    if (/logo|label|text|print|graphic/.test(signal)) observations.push(observation(productId, image.id, "logo_or_text_presence", true, 0.66, "Image signal suggests visible logo, label, text, or graphic. Brand remains unknown until readable evidence exists.", image.url));
    const inferred = inferUniversalCategoryId(signal);
    if (inferred) observations.push(observation(productId, image.id, "category_candidate", universalCategoryLabels[inferred], 0.62, `Image signal resembles ${universalCategoryLabels[inferred]}; this is a candidate only and cannot override supplier or user evidence.`, image.url));
  }
  for (const row of quality) {
    observations.push(observation(productId, row.imageId, "image_quality", { sharpness: row.sharpness, resolution: row.resolution, marketplaceSuitability: row.marketplaceSuitability }, 0.92, row.explanation));
    observations.push(observation(productId, row.imageId, "cover_suitability", row.marketplaceSuitability, row.marketplaceSuitability / 100, row.explanation));
    observations.push(observation(productId, row.imageId, "background_quality", 100 - row.backgroundDistraction, (100 - row.backgroundDistraction) / 100, "Background quality is scored separately from product quality."));
    observations.push(observation(productId, row.imageId, "product_visibility", row.productVisibility, row.productVisibility / 100, "Product visibility estimates whether the whole item is usable for marketplace presentation."));
    if (row.role === "size_chart") observations.push(observation(productId, row.imageId, "variant_association", "size chart", 0.86, "Image appears to be a size chart and should not be recommended as cover."));
    if (row.role === "detail") observations.push(observation(productId, row.imageId, "variant_association", "detail shot", 0.78, "Image appears to be a detail shot rather than a main product image."));
    if (row.duplicateSimilarity >= 95) observations.push(observation(productId, row.imageId, "duplicate_status", "near duplicate", 0.95, "Image is visually near-identical by normalized source identity."));
  }
  data.productImageQuality!.push(...quality);
  data.productImageObservations!.push(...observations);
  return { product, images, quality, observations, recommendation: recommendProductCover(data, productId) };
}

export function categoryCandidatesForProduct(data: OperatingData, productId: string): CategoryCandidate[] {
  ensureVisualIntelligenceCollections(data);
  const product = data.products.find((entry) => entry.id === productId);
  const summary = productKnowledgeSummary(data, productId);
  const supplierCategory = summary.fields.find((field) => field.fieldKey === "universal_category" || field.fieldKey === "product_type");
  const observations = (data.productImageObservations || []).filter((entry) => entry.productId === productId);
  const scores = new Map<UniversalCategoryId, CategoryCandidate>();
  const add = (categoryId: UniversalCategoryId, points: number, support: string, conflict?: string) => {
    const current = scores.get(categoryId) || { id: categoryId, label: universalCategoryLabels[categoryId], confidence: 0, supportingEvidence: [], conflictingEvidence: [] };
    current.confidence += points;
    current.supportingEvidence.push(support);
    if (conflict) current.conflictingEvidence.push(conflict);
    scores.set(categoryId, current);
  };
  const textSignals = `${product?.title || ""} ${product?.category || ""} ${String(supplierCategory?.value || "")}`;
  const textCategory = inferUniversalCategoryId(textSignals);
  if (textCategory) add(textCategory, supplierCategory?.source === "evidence" ? 58 : 36, supplierCategory?.source === "evidence" ? "Supplier category evidence" : "Product title/category text");
  for (const obs of observations.filter((entry) => entry.observationType === "category_candidate")) {
    const categoryId = inferUniversalCategoryId(String(obs.value));
    if (categoryId) add(categoryId, Math.round(obs.confidence * 38), `Image observation: ${obs.explanation}`);
  }
  for (const field of summary.fields.filter((entry) => entry.source === "memory" && entry.fieldKey === "universal_category")) {
    const categoryId = inferUniversalCategoryId(String(field.value));
    if (categoryId) add(categoryId, 16, "Product Knowledge Memory");
  }
  for (const candidate of scores.values()) {
    const profile = universalCategoryProfiles[candidate.id];
    for (const related of profile.commonConfusions) if (scores.has(related)) candidate.conflictingEvidence.push(`Potential confusion with ${universalCategoryLabels[related]}.`);
    candidate.confidence = Math.min(99, Math.round(candidate.confidence));
  }
  return [...scores.values()].sort((a, b) => b.confidence - a.confidence);
}

export function diagnoseCategoryBenchmarkFailures(failures: { expected: unknown; actual: unknown; fixtureId?: string }[]) {
  return failures.map((failure) => {
    const expected = compact((failure.expected as { value?: unknown; values?: unknown[] })?.value || (failure.expected as { values?: unknown[] })?.values?.[0]);
    const actual = compact(failure.actual);
    const reason = !actual ? "extraction failure" : expected.includes("accessor") || actual.includes("accessor") ? "taxonomy gap" : expected.includes(actual) || actual.includes(expected) ? "fixture expectation issue" : /shirt|top|tee|sweat/.test(`${expected} ${actual}`) ? "ambiguous source" : "incorrect mapping rule";
    return { fixtureId: failure.fixtureId, expected, actual, classification: reason as "extraction failure" | "translation failure" | "taxonomy gap" | "ambiguous source" | "incorrect mapping rule" | "memory error" | "fixture expectation issue" };
  });
}

export function recommendProductCover(data: OperatingData, productId: string): ProductCoverRecommendation | undefined {
  ensureVisualIntelligenceCollections(data);
  const product = data.products.find((entry) => entry.id === productId);
  if (!product) return undefined;
  const existingOverride = data.productCoverRecommendations!.find((entry) => entry.productId === productId && ["approved", "overridden"].includes(entry.status));
  if (existingOverride) return existingOverride;
  const qualities = (data.productImageQuality || []).filter((entry) => entry.productId === productId);
  if (!qualities.length) return undefined;
  const ranked = [...qualities].sort((a, b) => b.marketplaceSuitability - a.marketplaceSuitability);
  const selected = ranked[0];
  const lowerRankReasons = Object.fromEntries(ranked.slice(1).map((row) => [row.imageId, row.role === "size_chart" ? "Size charts are useful detail references but poor covers." : row.duplicateSimilarity >= 95 ? "Near-duplicate image ranked lower to avoid repetitive galleries." : row.backgroundDistraction > 45 ? "Background is more distracting than the recommended cover." : row.marketplaceSuitability < selected.marketplaceSuitability ? "Lower marketplace suitability score." : "Ranked lower by stable image order."]));
  const time = now();
  const recommendation: ProductCoverRecommendation = { id: id(), productId, recommendedImageId: selected.imageId, confidence: selected.marketplaceSuitability / 100, explanation: selected.role === "cover_candidate" ? "Recommended because the full Product is visible, background risk is low, and marketplace crop suitability is strongest." : selected.explanation, rankedImageIds: ranked.map((row) => row.imageId), lowerRankReasons, status: "suggested", createdAt: time, updatedAt: time };
  data.productCoverRecommendations!.push(recommendation);
  return recommendation;
}

export function applyImageReviewDecision(data: OperatingData, input: { productId: string; imageId?: string; action: ProductImageReviewDecision["action"]; value?: ProductKnowledgeField["value"]; fieldKey?: ProductKnowledgeFieldKey; reason?: string; actor?: string }) {
  ensureVisualIntelligenceCollections(data);
  const product = data.products.find((entry) => entry.id === input.productId);
  if (!product) throw new Error("Product not found.");
  const decision: ProductImageReviewDecision = { id: id(), productId: input.productId, imageId: input.imageId, fieldKey: input.fieldKey, action: input.action, value: input.value, reason: input.reason, decidedBy: input.actor || "local-user", decidedAt: now() };
  data.productImageReviewDecisions!.push(decision);
  if (input.action === "choose_cover" && input.imageId) {
    product.coverImageId = input.imageId;
    for (const image of data.productImages || []) if (image.productId === product.id) image.isCover = image.id === input.imageId;
    const recommendation = data.productCoverRecommendations!.find((entry) => entry.productId === input.productId && entry.status === "suggested") || recommendProductCover(data, input.productId);
    if (recommendation) {
      recommendation.status = "overridden";
      recommendation.overrideImageId = input.imageId;
      recommendation.decidedAt = decision.decidedAt;
      recommendation.decidedBy = decision.decidedBy;
      recommendation.updatedAt = decision.decidedAt;
    }
  } else if (input.action === "approve_cover") {
    const recommendation = data.productCoverRecommendations!.find((entry) => entry.productId === input.productId && entry.status === "suggested");
    if (recommendation) {
      product.coverImageId = recommendation.recommendedImageId;
      recommendation.status = "approved";
      recommendation.decidedAt = decision.decidedAt;
      recommendation.decidedBy = decision.decidedBy;
      recommendation.updatedAt = decision.decidedAt;
    }
  } else if (input.action === "mark_size_chart" || input.action === "mark_detail_only" || input.action === "exclude_from_publishing" || input.action === "restore_excluded_image") {
    const quality = data.productImageQuality!.find((entry) => entry.productId === input.productId && entry.imageId === input.imageId);
    if (quality) {
      quality.role = input.action === "mark_size_chart" ? "size_chart" : input.action === "mark_detail_only" ? "detail" : input.action === "exclude_from_publishing" ? "excluded" : "gallery";
      quality.updatedAt = decision.decidedAt;
    }
  } else if (input.action === "approve_category_candidate" && input.fieldKey === "universal_category") {
    applyProductKnowledgeDecision(data, { productId: input.productId, fieldKey: "universal_category", decision: "corrected", value: input.value, reason: input.reason || "Approved image-supported category candidate.", actor: input.actor });
  }
  product.updatedAt = decision.decidedAt;
  return decision;
}

export function visualIntelligenceSummary(data: OperatingData, productId: string) {
  ensureVisualIntelligenceCollections(data);
  if (!(data.productImageQuality || []).some((entry) => entry.productId === productId)) analyzeProductImages(data, productId);
  const observations = (data.productImageObservations || []).filter((entry) => entry.productId === productId);
  const qualities = (data.productImageQuality || []).filter((entry) => entry.productId === productId);
  const recommendation = (data.productCoverRecommendations || []).find((entry) => entry.productId === productId && ["suggested", "approved", "overridden"].includes(entry.status)) || recommendProductCover(data, productId);
  const candidates = categoryCandidatesForProduct(data, productId);
  const product = data.products.find((entry) => entry.id === productId);
  const cover = product ? productCoverRecord(data, product) : undefined;
  const supplierCategory = productKnowledgeSummary(data, productId).fields.find((field) => field.fieldKey === "universal_category");
  const top = candidates[0];
  const conflict = top && supplierCategory?.value && compact(top.label) !== compact(supplierCategory.value) && supplierCategory.source === "evidence";
  return {
    observations,
    qualities,
    recommendation,
    categoryCandidates: candidates,
    coverImageId: cover?.id,
    conflict: conflict ? { supplierValue: supplierCategory.value, imageCandidate: top.label, message: `Supplier evidence says ${supplierCategory.value}; image structure suggests ${top.label}. Review required.` } : undefined,
    observability: {
      imageObservationsCreated: observations.length,
      categoryConflictsDetected: conflict ? 1 : 0,
      coverRecommendationsAccepted: (data.productCoverRecommendations || []).filter((entry) => entry.productId === productId && entry.status === "approved").length,
      coverRecommendationsOverridden: (data.productCoverRecommendations || []).filter((entry) => entry.productId === productId && entry.status === "overridden").length,
      imageDerivedFieldsApproved: (data.productImageReviewDecisions || []).filter((entry) => entry.productId === productId && entry.action === "approve_category_candidate").length,
      imageDerivedFieldsCorrected: (data.productImageReviewDecisions || []).filter((entry) => entry.productId === productId && entry.action === "correct_color").length,
      falsePositiveImageSuggestions: (data.productImageReviewDecisions || []).filter((entry) => entry.productId === productId && entry.action === "reject_category_candidate").length,
    },
  };
}
