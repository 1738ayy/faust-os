import type { OperatingData, Product, ProductKnowledgeEvidence, ProductKnowledgeField, ProductKnowledgeFieldKey, ProductKnowledgeMemory, Variant } from "@/domain/business";
import type { SuperbuyProduct } from "@/types/superbuy-product";
import { inferUniversalCategoryId, universalCategoryLabels } from "./marketplace-intelligence/mappings";

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();

type KnowledgeValue = ProductKnowledgeField["value"];
type ExtractedFact = { label: string; value: string; evidence?: ProductKnowledgeEvidence; confidence: number };
type CompletenessCategory = { label: string; score: number; missing: string[]; lowConfidence: string[]; conflicting: string[]; recommendedAction: string; expectedReadinessImprovement: number };

const fieldLabels: Record<ProductKnowledgeFieldKey, string> = {
  brand: "Brand",
  product_type: "Product type",
  universal_category: "Universal category",
  marketplace_category_candidates: "Marketplace category candidates",
  material: "Material",
  fabric_composition: "Fabric composition",
  lining_material: "Lining material",
  hardware_material: "Hardware material",
  trim_material: "Trim material",
  color: "Color",
  pattern: "Pattern",
  style: "Style",
  size: "Size",
  fit: "Fit",
  measurements: "Measurements",
  condition: "Condition",
  weight: "Weight",
  dimensions: "Dimensions",
  supplier: "Supplier",
  supplier_shop: "Supplier shop",
  supplier_platform: "Supplier platform",
  supplier_url: "Supplier URL",
  source_platform: "Source platform",
  source_url: "Source URL",
  price: "Price",
  domestic_shipping: "Domestic shipping",
  minimum_order_quantity: "Minimum order quantity",
  stock: "Stock",
  variant_groups: "Variant groups",
  variant_options: "Variant options",
  image_set: "Image set",
  suggested_title: "Suggested title",
  suggested_description: "Suggested description",
  suggested_keywords: "Suggested keywords",
  suggested_hashtags: "Suggested hashtags",
};

export const productKnowledgeFieldLabels = fieldLabels;

const sourceLabelMappings: Record<string, ProductKnowledgeFieldKey> = {
  "main fabric composition": "fabric_composition",
  "main material": "material",
  "fabric composition": "fabric_composition",
  "composition": "fabric_composition",
  "fabric": "fabric_composition",
  "material": "material",
  "main fabric": "fabric_composition",
  "主要面料成分": "fabric_composition",
  "材质": "material",
  "面料": "fabric_composition",
  "lining material": "lining_material",
  "里料": "lining_material",
  "hardware material": "hardware_material",
  "trim material": "trim_material",
  "product category": "universal_category",
  "category": "universal_category",
  "产品类别": "universal_category",
  "类目": "universal_category",
  "weight": "weight",
  "gross weight": "weight",
  "重量": "weight",
  "dimensions": "dimensions",
  "size": "size",
  "尺寸": "dimensions",
  "color": "color",
  "颜色": "color",
  "moq": "minimum_order_quantity",
  "minimum order quantity": "minimum_order_quantity",
  "起订量": "minimum_order_quantity",
  "stock": "stock",
  "库存": "stock",
};

export const productKnowledgeConfidenceRules = [
  "User-corrected and user-confirmed values are authoritative for that Product.",
  "Explicit supplier attributes outrank title, navigation, image, and generic heuristic inference.",
  "Memory may increase confidence only when the memory scope matches; it does not become authoritative by itself.",
  "Conflicting evidence lowers confidence and marks the field for review.",
  "Rejected values stay rejected until new evidence or a materially different suggestion exists.",
  "Workspace/business memory is isolated to the current OperatingData instance and is never global by default.",
];

export function ensureProductKnowledgeCollections(data: OperatingData) {
  data.productKnowledgeEvidence ||= [];
  data.productKnowledgeFields ||= [];
  data.productKnowledgeDecisions ||= [];
  data.productKnowledgeMemory ||= [];
  data.productKnowledgeConfidenceHistory ||= [];
}

function normalizeLabel(value: string) {
  return value.toLowerCase().replace(/[:：]/g, "").replace(/\s+/g, " ").trim();
}

function compact(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(compact).filter(Boolean).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value).replace(/\s+/g, " ").trim();
}

function addEvidence(data: OperatingData, evidence: Omit<ProductKnowledgeEvidence, "id" | "capturedAt" | "immutable">) {
  ensureProductKnowledgeCollections(data);
  const raw = compact(evidence.rawValue);
  if (!raw) return undefined;
  const existing = data.productKnowledgeEvidence!.find((entry) => entry.productId === evidence.productId && entry.sourceType === evidence.sourceType && entry.sourceLabel === evidence.sourceLabel && compact(entry.rawValue) === raw);
  if (existing) return existing;
  const created: ProductKnowledgeEvidence = { id: id(), capturedAt: now(), immutable: true, ...evidence };
  data.productKnowledgeEvidence!.push(created);
  return created;
}

function sourceAttributes(product: SuperbuyProduct): Record<string, unknown> {
  const raw = product as SuperbuyProduct & { rawAttributes?: Record<string, unknown>; attributes?: Record<string, unknown>; supplierAttributes?: Record<string, unknown> };
  return { ...(raw.rawAttributes || {}), ...(raw.attributes || {}), ...(raw.supplierAttributes || {}) };
}

function factFor(data: OperatingData, productId: string, product: SuperbuyProduct, keys: ProductKnowledgeFieldKey[], fallback?: { label: string; value?: unknown; confidence?: number }): ExtractedFact | undefined {
  const attrs = sourceAttributes(product);
  const facts = Object.entries(attrs).flatMap(([label, value]) => {
    const key = sourceLabelMappings[normalizeLabel(label)];
    const text = compact(value);
    return key && keys.includes(key) && text ? [{ label, value: text, confidence: 0.9 }] : [];
  });
  const selected = facts[0] || (fallback?.value !== undefined && compact(fallback.value) ? { label: fallback.label, value: compact(fallback.value), confidence: fallback.confidence || 0.72 } : undefined);
  if (!selected) return undefined;
  return { ...selected, evidence: addEvidence(data, { productId, sourceType: "supplier_attribute", sourceLabel: selected.label, rawValue: selected.value, normalizedFieldKey: keys[0], confidence: selected.confidence, sourceRecordId: product.superbuyUrl }) };
}

function allFactsFor(data: OperatingData, productId: string, product: SuperbuyProduct, keys: ProductKnowledgeFieldKey[]) {
  return Object.entries(sourceAttributes(product)).flatMap(([label, value]) => {
    const key = sourceLabelMappings[normalizeLabel(label)];
    const text = compact(value);
    if (!key || !keys.includes(key) || !text) return [];
    return [{ label, value: text, confidence: 0.9, evidence: addEvidence(data, { productId, sourceType: "supplier_attribute", sourceLabel: label, rawValue: text, normalizedFieldKey: key, confidence: 0.9, sourceRecordId: product.superbuyUrl }) }];
  });
}

function cleanSupplierName(value: unknown) {
  const raw = compact(value);
  if (!raw) return "";
  const knownChrome = /(shopping assistant|shipping calculator|forwarding|parcel tracking|shopping enquiry|english\/\s*usd|visit store|shop\s*visit store)/gi;
  const cleaned = raw.replace(knownChrome, " ").replace(/overall|description\s*\d(?:\.\d)?|service\s*\d(?:\.\d)?|logistics\s*\d(?:\.\d)?/gi, " ").replace(/\s+/g, " ").trim();
  const company = cleaned.match(/([A-Z][A-Za-z0-9\s.,&'-]{3,}?Co\.?,?\s*Ltd)/i)?.[1]
    || cleaned.match(/([A-Z][A-Za-z0-9\s.,&'-]{3,}?(?:Company|Factory|Store|Shop|E-commerce|Trading))/i)?.[1];
  return (company || cleaned).replace(/^[:\s-]+|[:\s-]+$/g, "");
}

function categoryFact(data: OperatingData, productId: string, product: SuperbuyProduct) {
  const explicit = factFor(data, productId, product, ["universal_category"], product.category ? { label: "Product Category", value: product.category, confidence: 0.74 } : undefined);
  const rawCategory = explicit?.value || product.category || "";
  const categoryId = rawCategory ? inferUniversalCategoryId(rawCategory) || inferUniversalCategoryId(`${rawCategory} ${product.title}`) : inferUniversalCategoryId(product.title);
  const label = categoryId ? universalCategoryLabels[categoryId] || categoryId : rawCategory || null;
  const alternatives = [...new Set([rawCategory, product.subcategory, categoryId].filter(Boolean))] as string[];
  return { fact: explicit, label, rawCategory, alternatives };
}

function memoryScore(memory: ProductKnowledgeMemory, scope?: Partial<ProductKnowledgeMemory>) {
  if (memory.status === "suspended") return -1;
  if (memory.scope === "supplier") return memory.supplierId && scope?.supplierId === memory.supplierId ? 50 : -1;
  if (memory.scope === "source_platform") return memory.sourcePlatform && scope?.sourcePlatform === memory.sourcePlatform ? 30 : -1;
  if (memory.scope === "universal_category") return memory.universalCategory && scope?.universalCategory === memory.universalCategory ? 20 : -1;
  if (memory.scope === "business") return 10;
  return memory.scope === "global" ? 1 : -1;
}

function memoryFor(data: OperatingData, type: ProductKnowledgeMemory["memoryType"], pattern: string, scope?: Partial<ProductKnowledgeMemory>) {
  ensureProductKnowledgeCollections(data);
  const normalized = normalizeLabel(pattern);
  return [...data.productKnowledgeMemory!]
    .filter((entry) => entry.memoryType === type && normalizeLabel(entry.pattern) === normalized)
    .sort((a, b) => memoryScore(b, scope) - memoryScore(a, scope))[0];
}

function applyMemory(data: OperatingData, type: ProductKnowledgeMemory["memoryType"], pattern: string, fallback: string, scope?: Partial<ProductKnowledgeMemory>) {
  const memory = memoryFor(data, type, pattern, scope);
  if (!memory || memoryScore(memory, scope) < 0) return { value: fallback, confidenceBoost: 0, memoryId: undefined as string | undefined };
  memory.usageCount += 1;
  memory.lastUsedAt = now();
  memory.updatedAt = now();
  return { value: memory.output, confidenceBoost: Math.min(0.16, memory.confidenceAdjustment), memoryId: memory.id, memory };
}

function valuesConflict(values: string[]) {
  const unique = [...new Set(values.map((value) => normalizeLabel(value)).filter(Boolean))];
  return unique.length > 1;
}

function upsertField(data: OperatingData, productId: string, fieldKey: ProductKnowledgeFieldKey, value: KnowledgeValue, options: { confidence: number; source: ProductKnowledgeField["source"]; explanation: string; evidenceIds?: string[]; conflictingEvidenceIds?: string[]; alternatives?: KnowledgeValue[]; reviewRequired?: boolean; sourceRecordId?: string }) {
  ensureProductKnowledgeCollections(data);
  const existing = data.productKnowledgeFields!.find((entry) => entry.productId === productId && entry.fieldKey === fieldKey);
  if (existing && ["confirmed", "corrected", "rejected"].includes(existing.status)) return existing;
  const previousConfidence = existing?.confidence ?? 0;
  const missing = value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
  const next: ProductKnowledgeField = existing || { id: id(), productId, fieldKey, value: null, confidence: 0, status: "missing", source: "missing", explanation: "", supportingEvidenceIds: [], revision: 0, updatedAt: now() };
  const conflictPenalty = options.conflictingEvidenceIds?.length ? 0.18 : 0;
  next.value = missing ? null : value;
  next.confidence = missing ? 0 : Math.max(0, Math.min(1, options.confidence - conflictPenalty));
  next.status = missing ? "missing" : "generated";
  next.source = missing ? "missing" : options.source;
  next.explanation = missing ? `No reliable ${fieldLabels[fieldKey].toLowerCase()} evidence was found.` : options.explanation;
  next.supportingEvidenceIds = options.evidenceIds || [];
  next.conflictingEvidenceIds = options.conflictingEvidenceIds || [];
  next.alternatives = options.alternatives || [];
  next.reviewRequired = Boolean(options.reviewRequired || options.conflictingEvidenceIds?.length || (next.status === "generated" && next.confidence < 0.75));
  next.sourceRecordId = options.sourceRecordId;
  next.revision += 1;
  next.updatedAt = now();
  data.productKnowledgeFields = [next, ...data.productKnowledgeFields!.filter((entry) => entry.id !== next.id)];
  if (previousConfidence !== next.confidence) data.productKnowledgeConfidenceHistory!.push({ id: id(), productId, fieldKey, previousConfidence, nextConfidence: next.confidence, reason: next.explanation, evidenceIds: [...next.supportingEvidenceIds, ...(next.conflictingEvidenceIds || [])], createdAt: now() });
  return next;
}

function pricePayload(source: SuperbuyProduct) {
  return {
    minimum: source.priceRange?.min ?? source.price ?? null,
    maximum: source.priceRange?.max ?? source.price ?? null,
    currency: source.priceCurrency || "USD",
    tiers: source.priceTiers || [],
    sourceOfTruth: source.priceCurrency === "RMB" || source.priceCurrency === "CNY" ? "supplier_original_currency" : "extension_display_currency",
  };
}

function variantPayload(source: SuperbuyProduct) {
  return {
    groups: source.variantOptions?.groups || [
      ...(source.variantOptions?.colors?.length ? [{ label: "Color", options: source.variantOptions.colors.map((label) => ({ label })) }] : []),
      ...(source.variantOptions?.sizes?.length ? [{ label: "Size", options: source.variantOptions.sizes.map((label) => ({ label })) }] : []),
    ],
    combinations: source.variantOptions?.combinations || [],
    rows: source.variants.map((variant) => ({ id: variant.id, name: variant.name, options: variant.options, image: variant.image, price: variant.price, stock: variant.stock })),
  };
}

export function buildProductKnowledgeFromSuperbuy(data: OperatingData, productId: string, source: SuperbuyProduct, supplierId?: string) {
  ensureProductKnowledgeCollections(data);
  for (const [label, value] of Object.entries(sourceAttributes(source))) {
    addEvidence(data, { productId, sourceType: "supplier_attribute", sourceLabel: label, rawValue: value as ProductKnowledgeEvidence["rawValue"], normalizedFieldKey: sourceLabelMappings[normalizeLabel(label)], confidence: sourceLabelMappings[normalizeLabel(label)] ? 0.9 : 0.55, sourceRecordId: source.superbuyUrl });
  }
  const titleEvidence = addEvidence(data, { productId, sourceType: "supplier_title", sourceLabel: "Supplier title", rawValue: source.title, normalizedFieldKey: "suggested_title", confidence: 0.92, sourceRecordId: source.superbuyUrl });
  const category = categoryFact(data, productId, source);
  const materialFacts = allFactsFor(data, productId, source, ["material", "fabric_composition", "lining_material", "hardware_material", "trim_material"]);
  const primaryMaterial = materialFacts.find((fact) => ["material", "main material", "材质"].includes(normalizeLabel(fact.label))) || materialFacts[0] || (source.material ? { label: "Material", value: source.material, confidence: 0.72, evidence: addEvidence(data, { productId, sourceType: "supplier_attribute", sourceLabel: "Material", rawValue: source.material, normalizedFieldKey: "material", confidence: 0.72, sourceRecordId: source.superbuyUrl }) } : undefined);
  const fabricComposition = materialFacts.find((fact) => sourceLabelMappings[normalizeLabel(fact.label)] === "fabric_composition");
  const supplierRaw = source.storeName || source.factoryName || source.supplier || "";
  const supplierEvidence = addEvidence(data, { productId, sourceType: "supplier_attribute", sourceLabel: "Supplier raw display", rawValue: supplierRaw || null, normalizedFieldKey: "supplier_shop", confidence: 0.84, sourceRecordId: source.superbuyUrl });
  const priceEvidence = addEvidence(data, { productId, sourceType: "supplier_price", sourceLabel: "Supplier price", rawValue: pricePayload(source), normalizedFieldKey: "price", confidence: 0.9, sourceRecordId: source.superbuyUrl });
  const domesticEvidence = addEvidence(data, { productId, sourceType: "supplier_price", sourceLabel: "Domestic shipping", rawValue: source.domesticShipping === undefined ? null : { amount: source.domesticShipping, currency: source.domesticShippingCurrency || "USD" }, normalizedFieldKey: "domestic_shipping", confidence: source.domesticShipping === undefined ? 0 : 0.86, sourceRecordId: source.superbuyUrl });
  const variantEvidence = addEvidence(data, { productId, sourceType: "supplier_variant", sourceLabel: "Variant groups and combinations", rawValue: variantPayload(source), normalizedFieldKey: "variant_groups", confidence: source.variants.length || source.variantOptions ? 0.86 : 0, sourceRecordId: source.superbuyUrl });
  const imageEvidence = addEvidence(data, { productId, sourceType: "supplier_image", sourceLabel: "Image set", rawValue: source.images.map((url, index) => ({ url, sourceOrder: index, main: index === 0 })), normalizedFieldKey: "image_set", confidence: source.images.length ? 0.9 : 0, sourceRecordId: source.superbuyUrl });
  const derivedStock = source.stock ?? (source.variants.some((variant) => variant.stock !== undefined) ? source.variants.reduce((sum, variant) => sum + (variant.stock || 0), 0) : null);
  const stockEvidence = addEvidence(data, { productId, sourceType: "supplier_attribute", sourceLabel: "Stock", rawValue: derivedStock, normalizedFieldKey: "stock", confidence: source.stock !== undefined || source.variants.some((variant) => variant.stock !== undefined) ? 0.86 : 0, sourceRecordId: source.superbuyUrl });
  const moqEvidence = addEvidence(data, { productId, sourceType: "supplier_attribute", sourceLabel: "Minimum order quantity", rawValue: source.minimumOrderQuantity ?? null, normalizedFieldKey: "minimum_order_quantity", confidence: source.minimumOrderQuantity !== undefined ? 0.82 : 0, sourceRecordId: source.superbuyUrl });
  const weightValue = source.shippingWeight || source.weight || null;
  const dimensionsValue = source.dimensionsParsed || source.dimensions || null;
  const weightEvidence = weightValue ? addEvidence(data, { productId, sourceType: "supplier_attribute", sourceLabel: source.shippingWeight ? "Estimated packaged weight" : "Product weight", rawValue: weightValue, normalizedFieldKey: "weight", confidence: source.shippingWeight ? 0.62 : 0.82, sourceRecordId: source.superbuyUrl }) : undefined;
  const dimensionsEvidence = dimensionsValue ? addEvidence(data, { productId, sourceType: "supplier_attribute", sourceLabel: "Dimensions", rawValue: dimensionsValue, normalizedFieldKey: "dimensions", confidence: source.dimensionsParsed ? 0.78 : 0.58, sourceRecordId: source.superbuyUrl }) : undefined;
  const categoryMemory = category.fact ? applyMemory(data, "category_mapping", category.rawCategory, category.label || category.rawCategory, { supplierId, sourcePlatform: source.source }) : undefined;
  const materialMemory = primaryMaterial ? applyMemory(data, "material_mapping", primaryMaterial.value, primaryMaterial.value, { supplierId, sourcePlatform: source.source, universalCategory: category.label || undefined }) : undefined;
  const supplierMemory = supplierEvidence ? applyMemory(data, "supplier_cleanup", compact(supplierEvidence.rawValue), cleanSupplierName(supplierEvidence.rawValue), { supplierId, sourcePlatform: source.source }) : undefined;
  const selectedMaterial = materialMemory?.value || primaryMaterial?.value || null;
  const materialConflictIds = valuesConflict(materialFacts.map((fact) => fact.value)) ? materialFacts.flatMap((fact) => fact.evidence?.id || []) : [];

  upsertField(data, productId, "suggested_title", source.title, { confidence: 0.92, source: "evidence", explanation: "Supplier title captured from the product page.", evidenceIds: titleEvidence ? [titleEvidence.id] : [], sourceRecordId: source.superbuyUrl });
  upsertField(data, productId, "product_type", category.rawCategory || category.label, { confidence: category.fact ? 0.86 : 0.52, source: category.fact ? "evidence" : "system_inference", explanation: category.fact ? "Explicit supplier product category captured from source attributes." : "Product type inferred from title because no explicit supplier category was found.", evidenceIds: category.fact?.evidence ? [category.fact.evidence.id] : titleEvidence ? [titleEvidence.id] : [], alternatives: category.alternatives, sourceRecordId: source.superbuyUrl });
  upsertField(data, productId, "universal_category", categoryMemory?.value || category.label, { confidence: Math.min(1, (category.fact ? 0.86 : 0.55) + (categoryMemory?.confidenceBoost || 0)), source: categoryMemory?.memoryId ? "memory" : category.fact ? "evidence" : "system_inference", explanation: categoryMemory?.memory ? `Confidence increased because this ${categoryMemory.memory.scope} category mapping was learned from prior corrections. Explicit supplier category '${category.rawCategory}' remains preserved as evidence.` : category.fact ? `Explicit supplier category '${category.rawCategory}' mapped to a Faust universal category.` : "Category inferred from the product title because no explicit category was found.", evidenceIds: category.fact?.evidence ? [category.fact.evidence.id] : titleEvidence ? [titleEvidence.id] : [], alternatives: category.alternatives, reviewRequired: !category.fact || !category.label, sourceRecordId: source.superbuyUrl });
  upsertField(data, productId, "marketplace_category_candidates", category.alternatives, { confidence: category.alternatives.length ? 0.66 : 0, source: "system_inference", explanation: "Candidate categories are derived from supplier category, mapped universal category, and source page category hints.", evidenceIds: category.fact?.evidence ? [category.fact.evidence.id] : [], sourceRecordId: source.superbuyUrl });
  upsertField(data, productId, "material", selectedMaterial, { confidence: Math.min(1, (primaryMaterial?.evidence ? 0.83 : 0) + (materialMemory?.confidenceBoost || 0)), source: materialMemory?.memoryId ? "memory" : primaryMaterial?.evidence ? "evidence" : "missing", explanation: materialMemory?.memory ? `Confidence increased because this ${materialMemory.memory.scope} material mapping was confirmed previously. Source evidence '${primaryMaterial?.label}' remains inspectable.` : primaryMaterial?.evidence ? `Selected from supplier attribute '${primaryMaterial.label}'.${materialConflictIds.length ? " Conflicting material evidence requires review." : ""}` : "No reliable material evidence was found.", evidenceIds: primaryMaterial?.evidence ? [primaryMaterial.evidence.id] : [], conflictingEvidenceIds: materialConflictIds.filter((entry) => entry !== primaryMaterial?.evidence?.id), alternatives: materialFacts.map((fact) => fact.value), sourceRecordId: source.superbuyUrl });
  upsertField(data, productId, "fabric_composition", fabricComposition?.value || selectedMaterial, { confidence: fabricComposition?.evidence ? 0.88 : primaryMaterial?.evidence ? 0.72 : 0, source: fabricComposition?.evidence || primaryMaterial?.evidence ? "evidence" : "missing", explanation: fabricComposition?.evidence ? `Fabric composition captured from '${fabricComposition.label}'.` : "Fabric composition falls back to the best available material evidence.", evidenceIds: [fabricComposition?.evidence?.id || primaryMaterial?.evidence?.id].filter((entry): entry is string => Boolean(entry)), sourceRecordId: source.superbuyUrl });
  upsertField(data, productId, "supplier", cleanSupplierName(supplierEvidence?.rawValue), { confidence: supplierEvidence ? 0.76 : 0, source: supplierEvidence ? "evidence" : "missing", explanation: "Supplier display name is cleaned separately from immutable raw supplier evidence.", evidenceIds: supplierEvidence ? [supplierEvidence.id] : [], sourceRecordId: source.superbuyUrl });
  upsertField(data, productId, "supplier_shop", supplierMemory?.value || cleanSupplierName(supplierEvidence?.rawValue), { confidence: Math.min(1, 0.76 + (supplierMemory?.confidenceBoost || 0)), source: supplierMemory?.memoryId ? "memory" : supplierEvidence ? "evidence" : "missing", explanation: supplierMemory?.memory ? "Supplier shop cleanup used a previously reviewed memory rule; raw source text remains preserved as evidence." : "Supplier shop name captured from the source page and cleaned before display; raw source text remains preserved as evidence.", evidenceIds: supplierEvidence ? [supplierEvidence.id] : [], sourceRecordId: source.superbuyUrl });
  upsertField(data, productId, "supplier_platform", "1688", { confidence: source.original1688Url || source.source === "1688" ? 1 : 0.7, source: "evidence", explanation: "The supplier marketplace is separated from the Superbuy sourcing-agent page.", evidenceIds: [], sourceRecordId: source.original1688Url || source.superbuyUrl });
  upsertField(data, productId, "supplier_url", source.original1688Url || source.supplierStoreUrl || null, { confidence: source.original1688Url ? 1 : source.supplierStoreUrl ? 0.7 : 0, source: source.original1688Url || source.supplierStoreUrl ? "evidence" : "missing", explanation: "Supplier URL points to the original marketplace or store page when exposed.", evidenceIds: [], sourceRecordId: source.superbuyUrl });
  upsertField(data, productId, "source_platform", source.source === "superbuy" ? "Superbuy" : "1688", { confidence: 1, source: "evidence", explanation: "Captured from the browser extension source adapter.", evidenceIds: [], sourceRecordId: source.superbuyUrl });
  upsertField(data, productId, "source_url", source.superbuyUrl, { confidence: 1, source: "evidence", explanation: "Agent/source URL captured from the scanned page.", evidenceIds: [], sourceRecordId: source.superbuyUrl });
  upsertField(data, productId, "price", pricePayload(source), { confidence: priceEvidence ? 0.9 : 0, source: priceEvidence ? "evidence" : "missing", explanation: "Supplier price preserves minimum, maximum, tiers, and currency; converted display prices are not treated as source truth.", evidenceIds: priceEvidence ? [priceEvidence.id] : [], sourceRecordId: source.superbuyUrl });
  upsertField(data, productId, "domestic_shipping", source.domesticShipping === undefined ? null : { amount: source.domesticShipping, currency: source.domesticShippingCurrency || "USD" }, { confidence: domesticEvidence ? 0.86 : 0, source: domesticEvidence ? "evidence" : "missing", explanation: source.domesticShipping === undefined ? "Domestic shipping was not exposed by the source page." : "Domestic supplier shipping captured separately from international freight.", evidenceIds: domesticEvidence ? [domesticEvidence.id] : [], sourceRecordId: source.superbuyUrl });
  upsertField(data, productId, "minimum_order_quantity", source.minimumOrderQuantity ?? null, { confidence: moqEvidence ? 0.82 : 0, source: moqEvidence ? "evidence" : "missing", explanation: source.minimumOrderQuantity === undefined ? "Minimum order quantity was not exposed by the source page." : "Minimum order quantity captured as a purchasing constraint.", evidenceIds: moqEvidence ? [moqEvidence.id] : [], sourceRecordId: source.superbuyUrl });
  upsertField(data, productId, "stock", derivedStock, { confidence: stockEvidence ? 0.86 : 0, source: stockEvidence ? "evidence" : "missing", explanation: "Stock is separated from sales count and review count; unknown stock remains missing.", evidenceIds: stockEvidence ? [stockEvidence.id] : [], sourceRecordId: source.superbuyUrl });
  upsertField(data, productId, "weight", weightValue, { confidence: source.shippingWeight ? 0.62 : source.weight ? 0.82 : 0, source: weightEvidence ? "evidence" : "missing", explanation: source.shippingWeight ? "Estimated packaged weight captured separately from explicit product weight." : source.weight ? "Product weight captured from supplier logistics information." : "No reliable weight evidence was found.", evidenceIds: weightEvidence ? [weightEvidence.id] : [], sourceRecordId: source.superbuyUrl });
  upsertField(data, productId, "dimensions", dimensionsValue, { confidence: source.dimensionsParsed ? 0.78 : source.dimensions ? 0.58 : 0, source: dimensionsEvidence ? "evidence" : "missing", explanation: source.dimensionsParsed ? "Dimensions parsed from supplier logistics information." : "Dimensions are missing or only partially available.", evidenceIds: dimensionsEvidence ? [dimensionsEvidence.id] : [], sourceRecordId: source.superbuyUrl });
  upsertField(data, productId, "variant_groups", variantPayload(source).groups, { confidence: variantEvidence ? 0.86 : 0, source: variantEvidence ? "evidence" : "missing", explanation: "Variant group labels preserve source options such as Color and Size instead of flattening into generic options.", evidenceIds: variantEvidence ? [variantEvidence.id] : [], sourceRecordId: source.superbuyUrl });
  upsertField(data, productId, "variant_options", variantPayload(source), { confidence: source.variants.length || source.variantOptions ? 0.86 : 0, source: source.variants.length || source.variantOptions ? "evidence" : "missing", explanation: "Per-variant price, stock, images, and valid combinations are preserved from source selectable rows where available.", evidenceIds: variantEvidence ? [variantEvidence.id] : [], sourceRecordId: source.superbuyUrl });
  upsertField(data, productId, "image_set", source.images.map((url, index) => ({ url, sourceOrder: index, main: index === 0 })), { confidence: source.images.length ? 0.9 : 0, source: imageEvidence ? "evidence" : "missing", explanation: "Source image order and main-image status captured from the supplier listing.", evidenceIds: imageEvidence ? [imageEvidence.id] : [], sourceRecordId: source.superbuyUrl });
  upsertField(data, productId, "suggested_description", source.description || source.title, { confidence: source.description ? 0.76 : 0.58, source: "system_inference", explanation: source.description ? "Description captured from source product copy." : "Fallback description generated from the supplier title.", evidenceIds: titleEvidence ? [titleEvidence.id] : [], sourceRecordId: source.superbuyUrl });
  upsertField(data, productId, "suggested_keywords", [...new Set([category.rawCategory, selectedMaterial, ...(source.variantOptions?.colors || []), ...(source.variantOptions?.sizes || [])].filter((entry): entry is string => Boolean(entry)).slice(0, 12))], { confidence: 0.66, source: "system_inference", explanation: "Keywords are derived from category, material, and variant evidence.", evidenceIds: [category.fact?.evidence?.id, primaryMaterial?.evidence?.id, variantEvidence?.id].filter((entry): entry is string => Boolean(entry)), sourceRecordId: source.superbuyUrl });
  return productKnowledgeSummary(data, productId);
}

export function applyProductKnowledgeDecision(data: OperatingData, input: { productId: string; fieldKey: ProductKnowledgeFieldKey; decision: "confirmed" | "corrected" | "rejected" | "overridden"; value?: KnowledgeValue; reason?: string; actor?: string }) {
  ensureProductKnowledgeCollections(data);
  const field = data.productKnowledgeFields!.find((entry) => entry.productId === input.productId && entry.fieldKey === input.fieldKey);
  if (!field) throw new Error("Product knowledge field not found.");
  const previousValue = field.value;
  const nextValue = input.decision === "rejected" ? field.value : input.value ?? field.value;
  const decidedAt = now();
  data.productKnowledgeDecisions!.push({ id: id(), productId: input.productId, fieldKey: input.fieldKey, decision: input.decision, previousValue, value: nextValue, reason: input.reason, decidedBy: input.actor || "local-user", decidedAt });
  field.value = input.decision === "rejected" ? field.value : nextValue;
  field.status = input.decision === "confirmed" ? "confirmed" : input.decision === "corrected" || input.decision === "overridden" ? "corrected" : "rejected";
  field.confidence = input.decision === "rejected" ? 0 : 1;
  field.source = "user_decision";
  field.reviewRequired = false;
  field.explanation = input.decision === "confirmed" ? "User confirmed this Product Knowledge value. This confirmation applies only to this Product unless a reviewed memory already exists." : input.decision === "rejected" ? "User rejected this Product Knowledge value; future inference must not auto-apply it unchanged." : "User corrected this Product Knowledge value. Faust creates reusable memory only when the correction is pattern-safe.";
  field.reviewedAt = decidedAt;
  field.reviewedBy = input.actor || "local-user";
  field.revision += 1;
  field.updatedAt = decidedAt;
  strengthenOrWeakenMemory(data, field, input);
  maybeCreateMemory(data, field, input);
  data.productKnowledgeConfidenceHistory!.push({ id: id(), productId: input.productId, fieldKey: input.fieldKey, previousConfidence: previousValue === nextValue ? field.confidence : 0, nextConfidence: field.confidence, reason: field.explanation, evidenceIds: field.supportingEvidenceIds, createdAt: decidedAt });
  return field;
}

const riskyBulkApprovalFields: ProductKnowledgeFieldKey[] = [
  "brand",
  "condition",
  "marketplace_category_candidates",
  "suggested_description",
  "suggested_keywords",
  "suggested_hashtags",
];

export function canBulkApproveProductKnowledgeField(field: ProductKnowledgeField) {
  return field.status === "generated"
    && field.source === "evidence"
    && field.confidence >= 0.82
    && !field.reviewRequired
    && !field.conflictingEvidenceIds?.length
    && !riskyBulkApprovalFields.includes(field.fieldKey);
}

export function approveHighConfidenceProductKnowledgeFacts(data: OperatingData, productId: string, input: { fieldKeys?: ProductKnowledgeFieldKey[]; actor?: string; reason?: string } = {}) {
  ensureProductKnowledgeCollections(data);
  const candidates = data.productKnowledgeFields!
    .filter((field) => field.productId === productId)
    .filter((field) => !input.fieldKeys || input.fieldKeys.includes(field.fieldKey))
    .filter(canBulkApproveProductKnowledgeField);
  for (const field of candidates) {
    applyProductKnowledgeDecision(data, {
      productId,
      fieldKey: field.fieldKey,
      decision: "confirmed",
      value: field.value,
      actor: input.actor || "local-user",
      reason: input.reason || "Bulk approved high-confidence supplier evidence.",
    });
  }
  return { approvedCount: candidates.length, approvedFieldKeys: candidates.map((field) => field.fieldKey) };
}

function strengthenOrWeakenMemory(data: OperatingData, field: ProductKnowledgeField, input: { decision: "confirmed" | "corrected" | "rejected" | "overridden" }) {
  const evidence = data.productKnowledgeEvidence!.find((entry) => field.supportingEvidenceIds.includes(entry.id));
  const memory = evidence ? memoryFor(data, field.fieldKey === "material" ? "material_mapping" : field.fieldKey === "universal_category" ? "category_mapping" : field.fieldKey === "supplier_shop" ? "supplier_cleanup" : "source_label_mapping", compact(evidence.rawValue)) : undefined;
  if (!memory) return;
  if (input.decision === "confirmed") {
    memory.successfulApplications = (memory.successfulApplications || 0) + 1;
    memory.lastConfirmedAt = now();
    memory.confidenceAdjustment = Math.min(0.18, memory.confidenceAdjustment + 0.02);
  } else if (input.decision === "corrected" || input.decision === "overridden") {
    memory.overriddenApplications = (memory.overriddenApplications || 0) + 1;
    memory.lastContradictedAt = now();
    memory.confidenceAdjustment = Math.max(0.02, memory.confidenceAdjustment - 0.04);
  } else if (input.decision === "rejected") {
    memory.rejectedApplications = (memory.rejectedApplications || 0) + 1;
    memory.lastContradictedAt = now();
    memory.confidenceAdjustment = Math.max(0, memory.confidenceAdjustment - 0.08);
    if ((memory.rejectedApplications || 0) >= 2) memory.status = "suspended";
  }
  memory.updatedAt = now();
}

function maybeCreateMemory(data: OperatingData, field: ProductKnowledgeField, input: { decision: "confirmed" | "corrected" | "rejected" | "overridden"; value?: KnowledgeValue; actor?: string }) {
  if (input.decision !== "corrected" && input.decision !== "overridden") return;
  const memoryType = field.fieldKey === "material" || field.fieldKey === "fabric_composition" ? "material_mapping" : field.fieldKey === "universal_category" || field.fieldKey === "product_type" ? "category_mapping" : field.fieldKey === "supplier_shop" || field.fieldKey === "supplier" ? "supplier_cleanup" : field.fieldKey === "brand" ? "brand_confirmation" : undefined;
  if (!memoryType || input.value === undefined || input.value === null) return;
  if (["suggested_title", "suggested_description", "weight", "dimensions", "price", "stock", "variant_options"].includes(field.fieldKey)) return;
  const evidence = data.productKnowledgeEvidence!.find((entry) => field.supportingEvidenceIds.includes(entry.id));
  const pattern = compact(evidence?.rawValue || field.value);
  const output = compact(input.value);
  if (!pattern || !output || normalizeLabel(pattern) === normalizeLabel(output)) return;
  const time = now();
  const existing = data.productKnowledgeMemory!.find((entry) => entry.memoryType === memoryType && normalizeLabel(entry.pattern) === normalizeLabel(pattern));
  if (existing) {
    existing.output = output;
    existing.confidenceAdjustment = Math.max(existing.confidenceAdjustment, 0.1);
    existing.status = "active";
    existing.updatedAt = time;
    return;
  }
  data.productKnowledgeMemory!.push({ id: id(), memoryType, pattern, output, confidenceAdjustment: 0.1, scope: "business", createdFromProductId: field.productId, createdFromFieldKey: field.fieldKey, createdBy: input.actor || "local-user", usageCount: 0, successfulApplications: 0, overriddenApplications: 0, rejectedApplications: 0, status: "active", createdAt: time, updatedAt: time });
}

export function productKnowledgeSummary(data: OperatingData, productId: string) {
  ensureProductKnowledgeCollections(data);
  const fields = data.productKnowledgeFields!.filter((entry) => entry.productId === productId);
  const evidence = data.productKnowledgeEvidence!.filter((entry) => entry.productId === productId);
  const decisions = data.productKnowledgeDecisions!.filter((entry) => entry.productId === productId);
  const completeness = productKnowledgeCompleteness(fields);
  return {
    fields,
    evidence,
    decisions,
    completeness,
    reviewPlan: productKnowledgeReviewPlan(fields),
    overview: productKnowledgeOverview(fields, evidence),
    observability: productKnowledgeObservability(data, productId),
  };
}

export function productKnowledgeOverview(fields: ProductKnowledgeField[], evidence: ProductKnowledgeEvidence[]) {
  const usable = fields.filter((field) => field.status !== "missing" && field.status !== "rejected");
  const understoodPercent = fields.length ? Math.round(usable.reduce((sum, field) => sum + (field.status === "confirmed" || field.status === "corrected" ? 1 : field.reviewRequired ? Math.min(field.confidence, 0.6) : field.confidence), 0) / fields.length * 100) : 0;
  const conflicts = fields.filter((field) => field.conflictingEvidenceIds?.length).length;
  const missing = fields.filter((field) => field.status === "missing" || field.status === "rejected").length;
  const mustReview = fields.filter((field) => field.reviewRequired || field.conflictingEvidenceIds?.length || field.status === "rejected").length;
  const confirmedEvidence = fields.filter((field) => field.status === "confirmed" && field.source !== "system_inference").length;
  return {
    understoodPercent,
    evidenceCount: evidence.length,
    mustReview,
    missing,
    conflicts,
    confirmedEvidence,
    recommendedPrimaryAction: mustReview ? `Review ${mustReview} uncertain field${mustReview === 1 ? "" : "s"}` : missing ? `Complete ${missing} missing field${missing === 1 ? "" : "s"}` : "Approve marketplace drafts",
  };
}

export function productKnowledgeReviewPlan(fields: ProductKnowledgeField[]) {
  const blockingKeys: ProductKnowledgeFieldKey[] = ["universal_category", "product_type", "price", "variant_options", "image_set"];
  const mustReview = fields.filter((field) => field.conflictingEvidenceIds?.length || field.status === "rejected" || (field.reviewRequired && (blockingKeys.includes(field.fieldKey) || field.confidence < 0.6)));
  const recommendedReview = fields.filter((field) => !mustReview.includes(field) && (field.reviewRequired || (field.status === "generated" && field.confidence < 0.82)));
  const alreadyUnderstood = fields.filter((field) => !mustReview.includes(field) && !recommendedReview.includes(field) && field.status !== "missing");
  const safeBulkApproval = fields.filter(canBulkApproveProductKnowledgeField);
  return { mustReview, recommendedReview, alreadyUnderstood, safeBulkApproval };
}

export function productKnowledgeFieldHistory(data: OperatingData, productId: string, fieldKey: ProductKnowledgeFieldKey) {
  ensureProductKnowledgeCollections(data);
  const field = data.productKnowledgeFields!.find((entry) => entry.productId === productId && entry.fieldKey === fieldKey);
  const evidence = data.productKnowledgeEvidence!.filter((entry) => entry.productId === productId && (entry.normalizedFieldKey === fieldKey || field?.supportingEvidenceIds.includes(entry.id) || field?.conflictingEvidenceIds?.includes(entry.id)));
  const decisions = data.productKnowledgeDecisions!.filter((entry) => entry.productId === productId && entry.fieldKey === fieldKey);
  const confidence = data.productKnowledgeConfidenceHistory!.filter((entry) => entry.productId === productId && entry.fieldKey === fieldKey);
  return [
    ...evidence.map((entry) => ({ type: "Imported" as const, value: entry.rawValue, actor: entry.sourceType, at: entry.capturedAt, reason: `Captured from ${entry.sourceLabel}.`, memoryAction: "No memory action." })),
    ...(field ? [{ type: "Generated" as const, value: field.value, actor: field.source, at: field.updatedAt, reason: field.explanation, memoryAction: field.source === "memory" ? "Memory influenced this suggestion." : "No memory action." }] : []),
    ...decisions.map((entry) => ({ type: entry.decision === "confirmed" ? "Confirmed" as const : entry.decision === "corrected" || entry.decision === "overridden" ? "Corrected" as const : "Rejected" as const, previousValue: entry.previousValue, value: entry.value, actor: entry.decidedBy || "local-user", at: entry.decidedAt, reason: entry.reason || "User reviewed this field.", memoryAction: entry.decision === "confirmed" ? "Strengthens matching memory when one exists." : entry.decision === "rejected" ? "Weakens matching memory and may suspend it." : "Creates or updates safe reusable memory when pattern-safe." })),
    ...confidence.map((entry) => ({ type: "Regenerated" as const, value: entry.nextConfidence, actor: "confidence-model", at: entry.createdAt, reason: entry.reason, memoryAction: "Confidence history recorded." })),
  ].sort((a, b) => a.at.localeCompare(b.at));
}

export function productKnowledgeCorrectionImpactPreview(data: OperatingData, productId: string, fieldKey: ProductKnowledgeFieldKey, nextValue: KnowledgeValue) {
  ensureProductKnowledgeCollections(data);
  const field = data.productKnowledgeFields!.find((entry) => entry.productId === productId && entry.fieldKey === fieldKey);
  const previousValue = field?.value ?? null;
  const updates = new Set<string>();
  const protectedItems = new Set<string>();
  if (fieldKey === "universal_category" || fieldKey === "product_type") {
    updates.add("marketplace draft categories");
    updates.add("required product detail groups");
    updates.add("Product completeness");
    updates.add("marketplace readiness");
  }
  if (fieldKey === "material" || fieldKey === "fabric_composition") {
    updates.add("marketplace attributes");
    updates.add("search keywords");
    updates.add("Product completeness");
  }
  if (fieldKey === "price" || fieldKey === "domestic_shipping") {
    updates.add("pricing review");
    updates.add("margin estimates");
  }
  if (fieldKey === "variant_options" || fieldKey === "variant_groups") {
    updates.add("variant draft mapping");
    updates.add("inventory setup requirements");
  }
  protectedItems.add("manually edited marketplace fields");
  protectedItems.add("user-approved Product photos");
  protectedItems.add("existing live listings");
  return {
    fieldKey,
    previousValue,
    nextValue,
    updates: [...updates],
    protectedItems: [...protectedItems],
    estimatedCompletenessLift: field?.status === "missing" || field?.status === "rejected" ? 9 : field?.reviewRequired ? 6 : 2,
    estimatedMarketplaceReadinessLift: fieldKey === "universal_category" || fieldKey === "variant_options" || fieldKey === "image_set" ? 12 : 4,
  };
}

export function productKnowledgeObservability(data: OperatingData, productId?: string) {
  ensureProductKnowledgeCollections(data);
  const fields = productId ? data.productKnowledgeFields!.filter((field) => field.productId === productId) : data.productKnowledgeFields!;
  const evidence = productId ? data.productKnowledgeEvidence!.filter((entry) => entry.productId === productId) : data.productKnowledgeEvidence!;
  const decisions = productId ? data.productKnowledgeDecisions!.filter((entry) => entry.productId === productId) : data.productKnowledgeDecisions!;
  const productIds = [...new Set(fields.map((field) => field.productId))];
  const completenessValues = productIds.map((id) => productKnowledgeOverview(data.productKnowledgeFields!.filter((field) => field.productId === id), data.productKnowledgeEvidence!.filter((entry) => entry.productId === id)).understoodPercent);
  return {
    evidenceRecordsCreated: evidence.length,
    decisionsMade: decisions.length,
    generatedFields: fields.filter((field) => field.status === "generated").length,
    confirmedFields: fields.filter((field) => field.status === "confirmed").length,
    correctedFields: fields.filter((field) => field.status === "corrected").length,
    rejectedFields: fields.filter((field) => field.status === "rejected").length,
    conflicts: fields.filter((field) => field.conflictingEvidenceIds?.length).length,
    memoryApplications: fields.filter((field) => field.source === "memory").length,
    memoryOverrides: data.productKnowledgeMemory!.reduce((sum, memory) => sum + (memory.overriddenApplications || 0), 0),
    suspendedMemories: data.productKnowledgeMemory!.filter((memory) => memory.status === "suspended").length,
    averageCompleteness: completenessValues.length ? Math.round(completenessValues.reduce((sum, value) => sum + value, 0) / completenessValues.length) : 0,
    averageReviewCount: productIds.length ? Math.round(fields.filter((field) => field.reviewRequired || field.conflictingEvidenceIds?.length).length / productIds.length * 10) / 10 : 0,
    averageTimeToReadyMinutes: estimateProductKnowledgeTimeToReady(fields).estimatedPkeMinutes,
  };
}

export function estimateProductKnowledgeTimeToReady(fields: ProductKnowledgeField[]) {
  const mustReview = fields.filter((field) => field.reviewRequired || field.conflictingEvidenceIds?.length || field.status === "rejected").length;
  const missing = fields.filter((field) => field.status === "missing").length;
  const corrections = fields.filter((field) => field.status === "corrected").length;
  const approvals = fields.filter(canBulkApproveProductKnowledgeField).length;
  const manualMinutes = Math.max(4, fields.length * 0.8 + missing * 1.2);
  const estimatedPkeMinutes = Math.max(1, mustReview * 0.7 + missing * 0.8 + corrections * 0.4 + approvals * 0.08);
  return {
    manualMinutes: Math.round(manualMinutes * 10) / 10,
    estimatedPkeMinutes: Math.round(estimatedPkeMinutes * 10) / 10,
    fieldsTyped: missing + corrections,
    fieldsApproved: approvals,
    corrections,
    unresolvedFields: mustReview + missing,
    effortSavedPercent: Math.max(0, Math.round((1 - estimatedPkeMinutes / manualMinutes) * 100)),
  };
}

function productKnowledgeCompleteness(fields: ProductKnowledgeField[]): CompletenessCategory[] {
  const scoreFor = (keys: ProductKnowledgeFieldKey[]) => {
    const selected = keys.map((key) => fields.find((field) => field.fieldKey === key));
    const points = selected.map((field) => !field || field.status === "missing" || field.status === "rejected" ? 0 : field.status === "confirmed" || field.status === "corrected" ? 1 : field.reviewRequired ? Math.min(field.confidence, 0.6) : field.confidence);
    return Math.round(points.reduce((sum, value) => sum + value, 0) / keys.length * 100);
  };
  const category = (label: string, keys: ProductKnowledgeFieldKey[], action: string) => {
    const selected = keys.map((key) => fields.find((field) => field.fieldKey === key));
    const missing = selected.filter((field) => !field || field.status === "missing" || field.status === "rejected").map((field, index) => fieldLabels[field?.fieldKey || keys[index]]);
    const lowConfidence = selected.filter((field) => field && field.status === "generated" && field.confidence < 0.75).map((field) => fieldLabels[field!.fieldKey]);
    const conflicting = selected.filter((field) => field?.conflictingEvidenceIds?.length).map((field) => fieldLabels[field!.fieldKey]);
    const score = scoreFor(keys);
    const recommendedAction = conflicting[0] ? `Resolve conflict: ${conflicting[0]}` : missing[0] ? `${action}: ${missing[0]}` : lowConfidence[0] ? `Confirm ${lowConfidence[0]}` : "Ready";
    return { label, score, missing, lowConfidence, conflicting, recommendedAction, expectedReadinessImprovement: Math.max(0, Math.round((100 - score) / 8)) };
  };
  return [
    category("Identity", ["brand", "product_type", "universal_category", "supplier_shop"], "Confirm identity"),
    category("Attributes", ["material", "fabric_composition", "color", "condition"], "Complete attributes"),
    category("Images", ["image_set"], "Review images"),
    category("Pricing", ["price", "domestic_shipping", "minimum_order_quantity"], "Confirm pricing"),
    category("Shipping", ["weight", "dimensions"], "Complete shipping"),
    category("Variants", ["variant_groups", "variant_options", "stock"], "Review variants"),
    category("Marketplace readiness", ["suggested_title", "suggested_description", "universal_category", "image_set"], "Approve draft inputs"),
  ];
}

export function productKnowledgeValue(data: OperatingData, productId: string, fieldKey: ProductKnowledgeFieldKey) {
  ensureProductKnowledgeCollections(data);
  const field = data.productKnowledgeFields!.find((entry) => entry.productId === productId && entry.fieldKey === fieldKey);
  if (!field || field.status === "missing" || field.status === "rejected") return undefined;
  return field.value;
}

export function productWithKnowledge(data: OperatingData, product: Product): Product {
  const title = productKnowledgeValue(data, product.id, "suggested_title");
  const description = productKnowledgeValue(data, product.id, "suggested_description");
  const category = productKnowledgeValue(data, product.id, "universal_category");
  const material = productKnowledgeValue(data, product.id, "material");
  return {
    ...product,
    title: typeof title === "string" ? title : product.title,
    description: typeof description === "string" ? description : product.description,
    category: typeof category === "string" ? category : product.category,
    tags: [...new Set([...product.tags, typeof material === "string" ? material : ""].filter(Boolean))],
  };
}

export function variantWithKnowledge(data: OperatingData, productId: string, variant: Variant): Variant {
  const condition = productKnowledgeValue(data, productId, "condition");
  const weight = productKnowledgeValue(data, productId, "weight");
  const parsedWeight = typeof weight === "string" ? Number(weight.match(/[\d.]+/)?.[0]) : undefined;
  return { ...variant, condition: typeof condition === "string" ? condition : variant.condition, weightOz: parsedWeight ? Math.round(parsedWeight * (String(weight).toLowerCase().includes("kg") ? 35.274 : String(weight).toLowerCase().includes("g") ? 0.035274 : 1) * 10) / 10 : variant.weightOz };
}
