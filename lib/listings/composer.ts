import type { OperatingData } from "../../domain/business";
import type { ManagedMarketplace } from "../marketplace-intelligence";
import { inspectProductMarketplaceDraft } from "../listings-core";
import { imageUrlsForMarketplace } from "./image-order";

export function buildCrossListingComposerModel(data: OperatingData, input: { variantId: string; marketplace: ManagedMarketplace }) {
  const inspector = inspectProductMarketplaceDraft(data, input);
  const draft = data.channelListingDrafts?.find((entry) => entry.variantId === input.variantId && entry.marketplace === input.marketplace);
  const product = data.products.find((entry) => entry.id === data.variants.find((variant) => variant.id === input.variantId)?.productId);
  const fields = (data.marketplaceListingDraftFields || [])
    .filter((field) => field.draftId === draft?.id)
    .map((field) => ({
      ...field,
      sourceLabel: field.source.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()),
      generatedLabel: field.generatedValue === null ? "Missing" : Array.isArray(field.generatedValue) ? field.generatedValue.join(", ") : String(field.generatedValue),
      currentLabel: field.currentValue === null ? "Missing" : Array.isArray(field.currentValue) ? field.currentValue.join(", ") : String(field.currentValue),
    }));
  return {
    productName: product?.title || "Unknown product",
    marketplace: input.marketplace,
    draftId: draft?.id || null,
    profileVersion: inspector.profileVersion,
    readiness: inspector.readinessResult,
    fields,
    imageUrls: product ? imageUrlsForMarketplace(data, product.id, input.marketplace) : inspector.generatedOutput.imageUrls,
    connectorPayloadPreview: inspector.connectorPayloadPreview,
  };
}
