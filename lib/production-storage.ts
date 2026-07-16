import { storageBuckets, type ProductionEnv } from "./production-config";

export type StorageArtifactKind =
  | "product-image"
  | "receipt"
  | "shipping-label"
  | "packing-photo"
  | "extension-screenshot"
  | "extension-dom-snapshot"
  | "extension-log"
  | "publish-evidence";

export type StorageDescriptor = {
  kind: StorageArtifactKind;
  bucket: string;
  pathPrefix: string;
  contentTypes: string[];
  private: boolean;
  retentionDays?: number;
};

export function productionStorageDescriptors(env?: ProductionEnv): StorageDescriptor[] {
  const buckets = storageBuckets(env);
  return [
    { kind: "product-image", bucket: buckets["product-images"], pathPrefix: "products/{businessId}/{productId}/", contentTypes: ["image/jpeg", "image/png", "image/webp"], private: false },
    { kind: "receipt", bucket: buckets.receipts, pathPrefix: "receipts/{businessId}/{expenseId}/", contentTypes: ["image/jpeg", "image/png", "application/pdf"], private: true, retentionDays: 2555 },
    { kind: "shipping-label", bucket: buckets["shipping-labels"], pathPrefix: "labels/{businessId}/{shipmentId}/", contentTypes: ["application/pdf", "image/png"], private: true, retentionDays: 2555 },
    { kind: "packing-photo", bucket: buckets["packing-photos"], pathPrefix: "packing/{businessId}/{shipmentId}/", contentTypes: ["image/jpeg", "image/png", "image/webp"], private: true, retentionDays: 365 },
    { kind: "extension-screenshot", bucket: buckets["extension-screenshots"], pathPrefix: "extension/screenshots/{businessId}/{draftId}/", contentTypes: ["image/png", "image/jpeg", "image/webp"], private: true, retentionDays: 180 },
    { kind: "extension-dom-snapshot", bucket: buckets["extension-dom-snapshots"], pathPrefix: "extension/dom/{businessId}/{draftId}/", contentTypes: ["text/html", "application/json"], private: true, retentionDays: 90 },
    { kind: "extension-log", bucket: buckets["extension-logs"], pathPrefix: "extension/logs/{businessId}/{deviceId}/", contentTypes: ["application/json", "text/plain"], private: true, retentionDays: 180 },
    { kind: "publish-evidence", bucket: buckets["publish-evidence"], pathPrefix: "extension/evidence/{businessId}/{draftId}/", contentTypes: ["application/json", "image/png", "text/html"], private: true, retentionDays: 365 },
  ];
}

export function storageReadiness(env?: ProductionEnv) {
  const descriptors = productionStorageDescriptors(env);
  const duplicateBuckets = descriptors.map((item) => item.bucket).filter((bucket, index, all) => all.indexOf(bucket) !== index);
  return { provider: "supabase-storage-ready", descriptors, bucketCount: new Set(descriptors.map((item) => item.bucket)).size, duplicateBuckets: [...new Set(duplicateBuckets)], ready: descriptors.every((item) => item.bucket && item.pathPrefix) };
}
