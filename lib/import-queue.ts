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
};

export type ImportQueueStatus = "ready_for_review" | "needs_attention" | "failed" | "completed" | "archived";

export type ImportQueueItem = {
  id: string;
  title: string;
  supplier: string;
  source: string;
  sourceUrl: string;
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

export function imageCandidates(product: SuperbuyProduct) {
  return Array.from(new Set([
    ...product.images,
    ...product.variants.flatMap((variant) => variant.image ? [variant.image] : []),
  ].filter((image): image is string => /^https?:\/\//.test(image))));
}

function productCreatedFromScan(data: OperatingData, product: SuperbuyProduct) {
  return data.products.find((entry) => entry.sourceUrl === product.superbuyUrl || entry.sourceUrl === product.original1688Url);
}

function statusFor(metadata: QueueMetadata, existingProduct: { id: string } | undefined): ImportQueueStatus {
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
      if (metadata.deletedAt) return [];
      const product = parseSuperbuyProduct(metadata.product);
      const existingProduct = productCreatedFromScan(data, product);
      const status = statusFor(metadata, existingProduct);
      if (status === "completed" && !options.includeCompleted) return [];
      if (status === "archived" && !options.includeArchived) return [];
      const convertedVariants = existingProduct ? activeVariants(data).filter((variant) => variant.productId === existingProduct.id).length : 0;
      const candidates = imageCandidates(product);
      return [{
        id: artifact.id,
        title: product.title,
        supplier: product.storeName || product.supplier || "Supplier needs review",
        source: product.source,
        sourceUrl: product.original1688Url || product.superbuyUrl,
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
    if (metadata.deletedAt) return summary;
    const product = parseSuperbuyProduct(metadata.product);
    const status = statusFor(metadata, productCreatedFromScan(data, product));
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
  if (metadata.deletedAt) return undefined;
  return parseSuperbuyProduct(metadata.product);
}

export function removeImportQueueItems(data: OperatingData, ids: string[]) {
  const idSet = new Set(ids);
  const before = data.extensionArtifacts?.length || 0;
  data.extensionArtifacts = (data.extensionArtifacts || []).filter((artifact) => !idSet.has(artifact.id));
  const removed = before - data.extensionArtifacts.length;
  return { removed };
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
