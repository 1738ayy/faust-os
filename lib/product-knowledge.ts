import type { OperatingData, Product, ProductKnowledgeEvidence, ProductKnowledgeField, ProductKnowledgeFieldKey, ProductKnowledgeMemory, Variant } from "@/domain/business";
import type { SuperbuyProduct } from "@/types/superbuy-product";
import { inferUniversalCategoryId, universalCategoryLabels } from "./marketplace-intelligence/mappings";

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();

type KnowledgeValue = ProductKnowledgeField["value"];

const fieldLabels: Record<ProductKnowledgeFieldKey, string> = {
  brand: "Brand",
  product_type: "Product type",
  universal_category: "Universal category",
  marketplace_category_candidates: "Marketplace category candidates",
  material: "Material",
  fabric_composition: "Fabric composition",
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
  variant_groups: "Variant groups",
  variant_options: "Variant options",
  image_set: "Image set",
  suggested_title: "Suggested title",
  suggested_description: "Suggested description",
  suggested_keywords: "Suggested keywords",
  suggested_hashtags: "Suggested hashtags",
};

const sourceLabelMappings: Record<string, ProductKnowledgeFieldKey> = {
  "main fabric composition": "material",
  "fabric composition": "material",
  "material": "material",
  "fabric": "material",
  "product category": "universal_category",
  "category": "universal_category",
  "weight": "weight",
  "gross weight": "weight",
  "dimensions": "dimensions",
  "size": "size",
  "color": "color",
};

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
  if (Array.isArray(value)) return value.join(", ");
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

function materialFrom(product: SuperbuyProduct) {
  const attrs = sourceAttributes(product);
  for (const [label, value] of Object.entries(attrs)) {
    if (["main fabric composition", "fabric composition", "material", "fabric"].includes(normalizeLabel(label)) && compact(value)) return { label, value: compact(value) };
  }
  return product.material ? { label: "Material", value: product.material } : undefined;
}

function categoryFrom(product: SuperbuyProduct) {
  const attrs = sourceAttributes(product);
  for (const [label, value] of Object.entries(attrs)) {
    if (normalizeLabel(label) === "product category" && compact(value)) return { label, value: compact(value) };
  }
  return product.category ? { label: "Product Category", value: product.category } : undefined;
}

function memoryFor(data: OperatingData, type: ProductKnowledgeMemory["memoryType"], pattern: string, scope?: Partial<ProductKnowledgeMemory>) {
  ensureProductKnowledgeCollections(data);
  const normalized = normalizeLabel(pattern);
  const targetScope = scope || {};
  return data.productKnowledgeMemory!.find((entry) => entry.memoryType === type && normalizeLabel(entry.pattern) === normalized && (!entry.supplierId || !targetScope.supplierId || entry.supplierId === targetScope.supplierId) && (!entry.sourcePlatform || !targetScope.sourcePlatform || entry.sourcePlatform === targetScope.sourcePlatform));
}

function applyMemory(data: OperatingData, type: ProductKnowledgeMemory["memoryType"], pattern: string, fallback: string, scope?: Partial<ProductKnowledgeMemory>) {
  const memory = memoryFor(data, type, pattern, scope);
  if (!memory) return { value: fallback, confidenceBoost: 0, memoryId: undefined as string | undefined };
  memory.usageCount += 1;
  memory.lastUsedAt = now();
  memory.updatedAt = now();
  return { value: memory.output, confidenceBoost: memory.confidenceAdjustment, memoryId: memory.id };
}

function upsertField(data: OperatingData, productId: string, fieldKey: ProductKnowledgeFieldKey, value: KnowledgeValue, options: { confidence: number; source: ProductKnowledgeField["source"]; explanation: string; evidenceIds?: string[]; sourceRecordId?: string }) {
  ensureProductKnowledgeCollections(data);
  const existing = data.productKnowledgeFields!.find((entry) => entry.productId === productId && entry.fieldKey === fieldKey);
  if (existing && ["confirmed", "corrected", "rejected"].includes(existing.status)) return existing;
  const previousConfidence = existing?.confidence ?? 0;
  const missing = value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
  const next: ProductKnowledgeField = existing || { id: id(), productId, fieldKey, value: null, confidence: 0, status: "missing", source: "missing", explanation: "", supportingEvidenceIds: [], revision: 0, updatedAt: now() };
  next.value = missing ? null : value;
  next.confidence = missing ? 0 : Math.max(0, Math.min(1, options.confidence));
  next.status = missing ? "missing" : "generated";
  next.source = missing ? "missing" : options.source;
  next.explanation = missing ? `No reliable ${fieldLabels[fieldKey].toLowerCase()} evidence was found.` : options.explanation;
  next.supportingEvidenceIds = options.evidenceIds || [];
  next.sourceRecordId = options.sourceRecordId;
  next.revision += 1;
  next.updatedAt = now();
  data.productKnowledgeFields = [next, ...data.productKnowledgeFields!.filter((entry) => entry.id !== next.id)];
  if (previousConfidence !== next.confidence) data.productKnowledgeConfidenceHistory!.push({ id: id(), productId, fieldKey, previousConfidence, nextConfidence: next.confidence, reason: next.explanation, evidenceIds: next.supportingEvidenceIds, createdAt: now() });
  return next;
}

export function buildProductKnowledgeFromSuperbuy(data: OperatingData, productId: string, source: SuperbuyProduct, supplierId?: string) {
  ensureProductKnowledgeCollections(data);
  const attrs = sourceAttributes(source);
  for (const [label, value] of Object.entries(attrs)) {
    addEvidence(data, { productId, sourceType: "supplier_attribute", sourceLabel: label, rawValue: value as ProductKnowledgeEvidence["rawValue"], normalizedFieldKey: sourceLabelMappings[normalizeLabel(label)], confidence: sourceLabelMappings[normalizeLabel(label)] ? 0.9 : 0.55, sourceRecordId: source.superbuyUrl });
  }
  const titleEvidence = addEvidence(data, { productId, sourceType: "supplier_title", sourceLabel: "Supplier title", rawValue: source.title, normalizedFieldKey: "suggested_title", confidence: 0.92, sourceRecordId: source.superbuyUrl });
  const category = categoryFrom(source);
  const material = materialFrom(source);
  const categoryEvidence = category ? addEvidence(data, { productId, sourceType: "supplier_attribute", sourceLabel: category.label, rawValue: category.value, normalizedFieldKey: "universal_category", confidence: 0.91, sourceRecordId: source.superbuyUrl }) : undefined;
  const materialEvidence = material ? addEvidence(data, { productId, sourceType: "supplier_attribute", sourceLabel: material.label, rawValue: material.value, normalizedFieldKey: "material", confidence: 0.88, sourceRecordId: source.superbuyUrl }) : undefined;
  const supplierEvidence = addEvidence(data, { productId, sourceType: "supplier_attribute", sourceLabel: "Supplier shop", rawValue: source.storeName || source.factoryName || source.supplier || null, normalizedFieldKey: "supplier_shop", confidence: 0.84, sourceRecordId: source.superbuyUrl });
  const priceEvidence = addEvidence(data, { productId, sourceType: "supplier_price", sourceLabel: "RMB price", rawValue: source.priceRange ? `${source.priceRange.min}-${source.priceRange.max}` : source.price ?? null, normalizedFieldKey: "price", confidence: 0.9, sourceRecordId: source.superbuyUrl });
  const domesticEvidence = addEvidence(data, { productId, sourceType: "supplier_price", sourceLabel: "Domestic shipping", rawValue: source.domesticShipping ?? null, normalizedFieldKey: "domestic_shipping", confidence: source.domesticShipping === undefined ? 0 : 0.86, sourceRecordId: source.superbuyUrl });
  const variantOptionRecords = source.variants.map((variant) => ({ name: variant.name, options: variant.options, price: variant.price, stock: variant.stock }));
  const variantEvidence = addEvidence(data, { productId, sourceType: "supplier_variant", sourceLabel: "Variant groups", rawValue: source.variantOptions || { variants: variantOptionRecords }, normalizedFieldKey: "variant_groups", confidence: source.variants.length ? 0.86 : 0, sourceRecordId: source.superbuyUrl });
  const imageEvidence = addEvidence(data, { productId, sourceType: "supplier_image", sourceLabel: "Image set", rawValue: source.images, normalizedFieldKey: "image_set", confidence: source.images.length ? 0.9 : 0, sourceRecordId: source.superbuyUrl });
  const categoryId = category?.value ? inferUniversalCategoryId(category.value) || inferUniversalCategoryId(`${category.value} ${source.title}`) : inferUniversalCategoryId(source.title);
  const categoryLabel = categoryId ? universalCategoryLabels[categoryId] || categoryId : category?.value || null;
  const categoryMemory = category ? applyMemory(data, "category_mapping", category.value, categoryLabel || category.value, { supplierId, sourcePlatform: source.source }) : undefined;
  const materialMemory = material ? applyMemory(data, "material_mapping", material.value, material.value, { supplierId, sourcePlatform: source.source }) : undefined;
  const supplierMemory = supplierEvidence ? applyMemory(data, "supplier_cleanup", compact(supplierEvidence.rawValue), compact(supplierEvidence.rawValue), { supplierId, sourcePlatform: source.source }) : undefined;

  upsertField(data, productId, "suggested_title", source.title, { confidence: 0.92, source: "evidence", explanation: "Supplier title captured from the product page.", evidenceIds: titleEvidence ? [titleEvidence.id] : [], sourceRecordId: source.superbuyUrl });
  upsertField(data, productId, "universal_category", categoryMemory?.value || categoryLabel, { confidence: Math.min(1, (categoryEvidence ? 0.86 : 0.55) + (categoryMemory?.confidenceBoost || 0)), source: categoryMemory?.memoryId ? "memory" : "evidence", explanation: categoryEvidence ? `Explicit supplier category '${category?.value}' mapped to a Faust universal category.` : "Category inferred from the product title because no explicit category was found.", evidenceIds: categoryEvidence ? [categoryEvidence.id] : titleEvidence ? [titleEvidence.id] : [], sourceRecordId: source.superbuyUrl });
  upsertField(data, productId, "material", materialMemory?.value || material?.value || null, { confidence: Math.min(1, (materialEvidence ? 0.83 : 0) + (materialMemory?.confidenceBoost || 0)), source: materialMemory?.memoryId ? "memory" : materialEvidence ? "evidence" : "missing", explanation: materialEvidence ? `Extracted from supplier attribute '${material?.label}'.` : "No reliable material evidence was found.", evidenceIds: materialEvidence ? [materialEvidence.id] : [], sourceRecordId: source.superbuyUrl });
  upsertField(data, productId, "supplier_shop", supplierMemory?.value || compact(supplierEvidence?.rawValue), { confidence: Math.min(1, 0.76 + (supplierMemory?.confidenceBoost || 0)), source: supplierMemory?.memoryId ? "memory" : "evidence", explanation: "Supplier shop name captured from the source page and cleaned before display.", evidenceIds: supplierEvidence ? [supplierEvidence.id] : [], sourceRecordId: source.superbuyUrl });
  upsertField(data, productId, "source_platform", source.source, { confidence: 1, source: "evidence", explanation: "Captured from the browser extension source adapter.", evidenceIds: [], sourceRecordId: source.superbuyUrl });
  upsertField(data, productId, "source_url", source.original1688Url || source.superbuyUrl, { confidence: 1, source: "evidence", explanation: "Captured from the scanned product page.", evidenceIds: [], sourceRecordId: source.superbuyUrl });
  upsertField(data, productId, "price", source.priceRange ? source.priceRange.min : source.price ?? null, { confidence: priceEvidence ? 0.9 : 0, source: priceEvidence ? "evidence" : "missing", explanation: "Supplier price captured from the source listing.", evidenceIds: priceEvidence ? [priceEvidence.id] : [], sourceRecordId: source.superbuyUrl });
  upsertField(data, productId, "domestic_shipping", source.domesticShipping ?? null, { confidence: domesticEvidence ? 0.86 : 0, source: domesticEvidence ? "evidence" : "missing", explanation: source.domesticShipping === undefined ? "Domestic shipping was not exposed by the source page." : "Domestic shipping captured from source pricing.", evidenceIds: domesticEvidence ? [domesticEvidence.id] : [], sourceRecordId: source.superbuyUrl });
  upsertField(data, productId, "weight", source.shippingWeight || source.weight || null, { confidence: source.shippingWeight || source.weight ? 0.82 : 0, source: source.shippingWeight || source.weight ? "evidence" : "missing", explanation: source.shippingWeight || source.weight ? "Weight captured from supplier logistics information." : "No reliable weight evidence was found.", evidenceIds: [], sourceRecordId: source.superbuyUrl });
  upsertField(data, productId, "dimensions", source.dimensionsParsed || source.dimensions || null, { confidence: source.dimensionsParsed || source.dimensions ? 0.78 : 0, source: source.dimensionsParsed || source.dimensions ? "evidence" : "missing", explanation: source.dimensionsParsed ? "Dimensions parsed from supplier logistics information." : "Dimensions are missing or only partially available.", evidenceIds: [], sourceRecordId: source.superbuyUrl });
  upsertField(data, productId, "variant_groups", source.variantOptions || null, { confidence: variantEvidence ? 0.86 : 0, source: variantEvidence ? "evidence" : "missing", explanation: "Variant group labels preserve source options such as Color and Size.", evidenceIds: variantEvidence ? [variantEvidence.id] : [], sourceRecordId: source.superbuyUrl });
  upsertField(data, productId, "variant_options", { variants: variantOptionRecords }, { confidence: source.variants.length ? 0.86 : 0, source: source.variants.length ? "evidence" : "missing", explanation: "Per-variant price and inventory preserved from source selectable rows.", evidenceIds: variantEvidence ? [variantEvidence.id] : [], sourceRecordId: source.superbuyUrl });
  upsertField(data, productId, "image_set", source.images, { confidence: source.images.length ? 0.9 : 0, source: imageEvidence ? "evidence" : "missing", explanation: "Source image order captured from the supplier listing.", evidenceIds: imageEvidence ? [imageEvidence.id] : [], sourceRecordId: source.superbuyUrl });
  upsertField(data, productId, "suggested_description", source.description || source.title, { confidence: source.description ? 0.76 : 0.58, source: "system_inference", explanation: source.description ? "Description captured from source product copy." : "Fallback description generated from the supplier title.", evidenceIds: titleEvidence ? [titleEvidence.id] : [], sourceRecordId: source.superbuyUrl });
  upsertField(data, productId, "suggested_keywords", [...new Set([source.category, material?.value, ...(source.variantOptions?.colors || []), ...(source.variantOptions?.sizes || [])].filter((entry): entry is string => Boolean(entry)).slice(0, 12))], { confidence: 0.66, source: "system_inference", explanation: "Keywords are derived from category, material, and variant evidence.", evidenceIds: [categoryEvidence?.id, materialEvidence?.id, variantEvidence?.id].filter((entry): entry is string => Boolean(entry)), sourceRecordId: source.superbuyUrl });
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
  field.explanation = input.decision === "confirmed" ? "User confirmed this Product Knowledge value." : input.decision === "rejected" ? "User rejected this Product Knowledge value; future inference must not auto-apply it." : "User corrected this Product Knowledge value and Faust will reuse it as memory.";
  field.reviewedAt = decidedAt;
  field.reviewedBy = input.actor || "local-user";
  field.revision += 1;
  field.updatedAt = decidedAt;
  maybeCreateMemory(data, field, input);
  return field;
}

function maybeCreateMemory(data: OperatingData, field: ProductKnowledgeField, input: { value?: KnowledgeValue; actor?: string }) {
  const memoryType = field.fieldKey === "material" ? "material_mapping" : field.fieldKey === "universal_category" ? "category_mapping" : field.fieldKey === "supplier_shop" ? "supplier_cleanup" : field.fieldKey === "brand" ? "brand_confirmation" : undefined;
  if (!memoryType || input.value === undefined || input.value === null) return;
  const evidence = data.productKnowledgeEvidence!.find((entry) => field.supportingEvidenceIds.includes(entry.id));
  const pattern = compact(evidence?.rawValue || field.value);
  const output = compact(input.value);
  if (!pattern || !output) return;
  const existing = data.productKnowledgeMemory!.find((entry) => entry.memoryType === memoryType && normalizeLabel(entry.pattern) === normalizeLabel(pattern));
  const time = now();
  if (existing) {
    existing.output = output;
    existing.confidenceAdjustment = Math.max(existing.confidenceAdjustment, 0.12);
    existing.updatedAt = time;
    return;
  }
  data.productKnowledgeMemory!.push({ id: id(), memoryType, pattern, output, confidenceAdjustment: 0.12, scope: "business", createdFromProductId: field.productId, createdFromFieldKey: field.fieldKey, createdBy: input.actor || "local-user", usageCount: 0, createdAt: time, updatedAt: time });
}

export function productKnowledgeSummary(data: OperatingData, productId: string) {
  ensureProductKnowledgeCollections(data);
  const fields = data.productKnowledgeFields!.filter((entry) => entry.productId === productId);
  const evidence = data.productKnowledgeEvidence!.filter((entry) => entry.productId === productId);
  const decisions = data.productKnowledgeDecisions!.filter((entry) => entry.productId === productId);
  return { fields, evidence, decisions, completeness: productKnowledgeCompleteness(fields) };
}

function productKnowledgeCompleteness(fields: ProductKnowledgeField[]) {
  const scoreFor = (keys: ProductKnowledgeFieldKey[]) => {
    const selected = keys.map((key) => fields.find((field) => field.fieldKey === key));
    const points = selected.map((field) => !field || field.status === "missing" || field.status === "rejected" ? 0 : field.status === "confirmed" || field.status === "corrected" ? 1 : field.confidence);
    return Math.round(points.reduce((sum, value) => sum + value, 0) / keys.length * 100);
  };
  const category = (label: string, keys: ProductKnowledgeFieldKey[], action: string) => {
    const selected = keys.map((key) => fields.find((field) => field.fieldKey === key));
    const missing = selected.filter((field) => !field || field.status === "missing" || field.status === "rejected").map((field, index) => fieldLabels[field?.fieldKey || keys[index]]);
    const lowConfidence = selected.filter((field) => field && field.status === "generated" && field.confidence < 0.75).map((field) => fieldLabels[field!.fieldKey]);
    const score = scoreFor(keys);
    return { label, score, missing, lowConfidence, recommendedAction: missing[0] ? `${action}: ${missing[0]}` : lowConfidence[0] ? `Confirm ${lowConfidence[0]}` : "Ready", expectedReadinessImprovement: Math.max(0, Math.round((100 - score) / 8)) };
  };
  return [
    category("Identity", ["brand", "product_type", "universal_category", "supplier_shop"], "Confirm identity"),
    category("Attributes", ["material", "color", "style", "condition"], "Complete attributes"),
    category("Images", ["image_set"], "Review images"),
    category("Pricing", ["price", "domestic_shipping"], "Confirm pricing"),
    category("Shipping", ["weight", "dimensions"], "Complete shipping"),
    category("Variants", ["variant_groups", "variant_options"], "Review variants"),
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
