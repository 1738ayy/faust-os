import type { ExtensionArtifact, OperatingData } from "../domain/business";
import { activeVariants } from "./product-state";
import { parseSuperbuyProduct } from "./validation/superbuy-product";
import type { SuperbuyProduct } from "../types/superbuy-product";

type QueueMetadata = ExtensionArtifact["metadata"] & {
  kind?: string;
  product?: unknown;
  queueStatus?: ImportQueueStatus;
  deletedAt?: string;
  archivedAt?: string;
  completedAt?: string;
  completedProductId?: string;
  canonicalListingKey?: string;
  canonicalUrl?: string;
  sourceListingId?: string;
  lastScannedAt?: string;
  mergedIntoImportId?: string;
};

export type ImportQueueStatus = "ready_for_review" | "needs_attention" | "failed" | "completed" | "archived" | "removed" | "merged" | "superseded";

export type ImportQueueItem = {
  id: string;
  title: string;
  supplier: string;
  source: string;
  sourceUrl: string;
  canonicalListingKey: string;
  canonicalUrl: string;
  sourceListingId?: string;
  image?: string;
  imageCandidates: string[];
  imageCount: number;
  variantCount: number;
  price?: number;
  importedAt: string;
  status: ImportQueueStatus;
  productId?: string;
  convertedVariants: number;
  product: SuperbuyProduct;
};

function metadataFor(artifact: ExtensionArtifact): QueueMetadata {
  return artifact.metadata as QueueMetadata;
}

export function isSourceScanArtifact(artifact: ExtensionArtifact) {
  const metadata = metadataFor(artifact);
  return metadata.kind === "latest_source_scan" && Boolean(metadata.product);
}

const TRACKING_PARAMS = new Set([
  "spm", "trackPayload", "nTag", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "ref", "referrer", "affiliate", "aff", "lang", "locale", "currency", "currencyCode", "timestamp", "_", "from",
]);

function stableHash(value: string) {
  let hash = 0;
  for (const char of value) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash.toString(36);
}

function normalizeUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    url.hash = "";
    for (const param of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(param) || param.toLowerCase().startsWith("utm_")) url.searchParams.delete(param);
    }
    url.protocol = "https:";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.pathname = url.pathname.replace(/\/+$/, "");
    return url.toString();
  } catch {
    return value.trim() || undefined;
  }
}

function embeddedSourceUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    const embedded = url.searchParams.get("url");
    if (!embedded) return undefined;
    return decodeURIComponent(embedded);
  } catch {
    return undefined;
  }
}

function sourceUrlFor(product: SuperbuyProduct) {
  return product.original1688Url || embeddedSourceUrl(product.superbuyUrl) || product.superbuyUrl;
}

function extractListingId(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    const offer = url.pathname.match(/\/offer\/(\d+)(?:\.html)?/i)?.[1];
    if (offer) return offer;
    return url.searchParams.get("id") || url.searchParams.get("itemId") || url.searchParams.get("offerId") || undefined;
  } catch {
    return value.match(/(?:offer|item|id)[^\d]*(\d{5,})/i)?.[1];
  }
}

export function canonicalListingIdentity(product: SuperbuyProduct) {
  const sourceUrl = sourceUrlFor(product);
  const sourceListingId = extractListingId(sourceUrl) || extractListingId(product.original1688Url) || extractListingId(product.superbuyUrl);
  const canonicalUrl = normalizeUrl(sourceUrl) || normalizeUrl(product.superbuyUrl) || product.superbuyUrl;
  const platform = sourceListingId && (sourceUrl || product.original1688Url || product.superbuyUrl).includes("1688.com") ? "1688" : product.source;
  const canonicalListingKey = sourceListingId
    ? `${platform}:listing:${sourceListingId}`
    : `${product.source}:fingerprint:${stableHash([canonicalUrl, product.storeName || product.supplier || "", product.title].join("|").toLowerCase())}`;
  return { canonicalListingKey, canonicalUrl, sourceListingId };
}

export function imageCandidates(product: SuperbuyProduct) {
  return Array.from(new Set([
    ...product.images,
    ...product.variants.flatMap((variant) => variant.image ? [variant.image] : []),
  ].filter((image): image is string => /^https?:\/\//.test(image))));
}

function productCreatedFromScan(data: OperatingData, product: SuperbuyProduct) {
  const identity = canonicalListingIdentity(product);
  return data.products.find((entry) => {
    if (!entry.sourceUrl) return false;
    const entryId = extractListingId(entry.sourceUrl);
    return entry.sourceUrl === product.superbuyUrl || entry.sourceUrl === product.original1688Url || Boolean(entryId && entryId === identity.sourceListingId) || normalizeUrl(entry.sourceUrl) === identity.canonicalUrl;
  });
}

function statusFor(metadata: QueueMetadata, existingProduct: { id: string } | undefined): ImportQueueStatus {
  if (metadata.deletedAt || metadata.queueStatus === "removed") return "removed";
  if (metadata.mergedIntoImportId || metadata.queueStatus === "merged" || metadata.queueStatus === "superseded") return metadata.queueStatus === "superseded" ? "superseded" : "merged";
  if (metadata.archivedAt || metadata.queueStatus === "archived") return "archived";
  if (metadata.completedAt || metadata.queueStatus === "completed" || existingProduct) return "completed";
  if (metadata.queueStatus === "failed" || metadata.queueStatus === "needs_attention") return metadata.queueStatus;
  return "ready_for_review";
}

export function buildImportQueue(data: OperatingData, options: { includeCompleted?: boolean; includeArchived?: boolean } = {}) {
  const scans = (data.extensionArtifacts || [])
    .filter(isSourceScanArtifact)
    .flatMap((artifact): ImportQueueItem[] => {
      const metadata = metadataFor(artifact);
      const product = parseSuperbuyProduct(metadata.product);
      const existingProduct = productCreatedFromScan(data, product);
      const status = statusFor(metadata, existingProduct);
      if (status === "removed" || status === "merged" || status === "superseded") return [];
      if (status === "completed" && !options.includeCompleted) return [];
      if (status === "archived" && !options.includeArchived) return [];
      const convertedVariants = existingProduct ? activeVariants(data).filter((variant) => variant.productId === existingProduct.id).length : 0;
      const candidates = imageCandidates(product);
      const identity = canonicalListingIdentity(product);
      return [{
        id: artifact.id,
        title: product.title,
        supplier: product.storeName || product.supplier || "Supplier needs review",
        source: product.source,
        sourceUrl: product.original1688Url || product.superbuyUrl,
        canonicalListingKey: metadata.canonicalListingKey || identity.canonicalListingKey,
        canonicalUrl: metadata.canonicalUrl || identity.canonicalUrl,
        sourceListingId: metadata.sourceListingId || identity.sourceListingId,
        image: candidates[0],
        imageCandidates: candidates,
        imageCount: candidates.length,
        variantCount: product.variants.length,
        price: product.price,
        importedAt: product.importedAt || artifact.createdAt,
        status,
        productId: existingProduct?.id || metadata.completedProductId,
        convertedVariants,
        product,
      }];
    })
    .sort((a, b) => new Date(a.importedAt).getTime() - new Date(b.importedAt).getTime());

  const allScans = (data.extensionArtifacts || []).filter(isSourceScanArtifact);
  const counts = allScans.reduce((summary, artifact) => {
    const metadata = metadataFor(artifact);
    const product = parseSuperbuyProduct(metadata.product);
    const status = statusFor(metadata, productCreatedFromScan(data, product));
    if (status === "removed" || status === "merged" || status === "superseded") return summary;
    if (status === "completed") summary.completed += 1;
    else if (status === "archived") summary.archived += 1;
    else {
      summary.active += 1;
      if (status === "failed" || status === "needs_attention") summary.needsAttention += 1;
    }
    return summary;
  }, { active: 0, completed: 0, archived: 0, needsAttention: 0 });

  return { scans, counts };
}

export function getImportQueueProduct(data: OperatingData, id: string) {
  const artifact = (data.extensionArtifacts || []).find((entry) => entry.id === id && isSourceScanArtifact(entry));
  if (!artifact) return undefined;
  const metadata = metadataFor(artifact);
  if (metadata.deletedAt || metadata.queueStatus === "removed") return undefined;
  return parseSuperbuyProduct(metadata.product);
}

export function removeImportQueueItems(data: OperatingData, ids: string[]) {
  const idSet = new Set(ids);
  const removedAt = new Date().toISOString();
  let removed = 0;
  for (const artifact of data.extensionArtifacts || []) {
    if (!idSet.has(artifact.id) || !isSourceScanArtifact(artifact)) continue;
    artifact.metadata = { ...artifact.metadata, queueStatus: "removed", deletedAt: removedAt };
    removed += 1;
  }
  return { removed };
}

export function upsertImportQueueScan(data: OperatingData, productInput: unknown) {
  const product = parseSuperbuyProduct(productInput);
  const identity = canonicalListingIdentity(product);
  const createdAt = new Date().toISOString();
  const existingProduct = productCreatedFromScan(data, product);
  const activeOrCompleted = (data.extensionArtifacts || []).find((artifact) => {
    if (!isSourceScanArtifact(artifact)) return false;
    const metadata = metadataFor(artifact);
    const existingKey = metadata.canonicalListingKey || canonicalListingIdentity(parseSuperbuyProduct(metadata.product)).canonicalListingKey;
    const status = statusFor(metadata, existingProduct);
    return existingKey === identity.canonicalListingKey && status !== "removed" && status !== "archived" && status !== "merged" && status !== "superseded";
  });
  if (activeOrCompleted) {
    activeOrCompleted.metadata = {
      ...activeOrCompleted.metadata,
      product,
      canonicalListingKey: identity.canonicalListingKey,
      canonicalUrl: identity.canonicalUrl,
      sourceListingId: identity.sourceListingId,
      lastScannedAt: createdAt,
    };
    return { artifact: activeOrCompleted, product, duplicate: true, existingProductId: existingProduct?.id };
  }
  const artifact: ExtensionArtifact = {
    id: crypto.randomUUID(),
    type: "log",
    storageProvider: "local_metadata",
    metadata: {
      kind: "latest_source_scan",
      product,
      queueStatus: existingProduct ? "completed" : "ready_for_review",
      completedAt: existingProduct ? createdAt : undefined,
      completedProductId: existingProduct?.id,
      canonicalListingKey: identity.canonicalListingKey,
      canonicalUrl: identity.canonicalUrl,
      sourceListingId: identity.sourceListingId,
      lastScannedAt: createdAt,
    },
    createdAt,
  };
  data.extensionArtifacts ||= [];
  data.extensionArtifacts.unshift(artifact);
  return { artifact, product, duplicate: false, existingProductId: existingProduct?.id };
}

export function markImportQueueItemCompleted(data: OperatingData, queueItemId: string | undefined, productId: string) {
  if (!queueItemId) return false;
  const artifact = (data.extensionArtifacts || []).find((entry) => entry.id === queueItemId && isSourceScanArtifact(entry));
  if (!artifact) return false;
  artifact.metadata = {
    ...artifact.metadata,
    queueStatus: "completed",
    completedAt: new Date().toISOString(),
    completedProductId: productId,
  };
  return true;
}
