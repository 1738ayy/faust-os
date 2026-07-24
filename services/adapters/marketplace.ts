import { getMarketplaceProfile, marketplaceForSlug, marketplaceSlugs, type MarketplaceSlug } from "../../lib/marketplace-intelligence";

export type MarketplaceDraft = { listingId: string; title: string; description: string; price: number; quantity: number; imageUrls: string[]; category?: string; condition?: string };
export type MarketplacePublishResult = { externalId: string; externalUrl: string; status: "active" | "pending"; warnings?: string[] };
export interface MarketplaceAdapter { readonly provider: string; validate(draft: MarketplaceDraft): string[]; publish(draft: MarketplaceDraft): Promise<MarketplacePublishResult>; endListing(externalId: string): Promise<void>; importOrders?(cursor?: string): Promise<{ cursor?: string; records: unknown[] }>; }
export class ManualMarketplaceAdapter implements MarketplaceAdapter { readonly provider = "manual"; validate(draft: MarketplaceDraft) { const errors: string[] = []; if (!draft.title.trim()) errors.push("Title is required."); if (draft.price <= 0) errors.push("Price must be greater than zero."); if (draft.quantity < 0) errors.push("Quantity cannot be negative."); return errors; } async publish(draft: MarketplaceDraft): Promise<MarketplacePublishResult> { void draft; throw new Error("Manual publish required: copy the generated title, description, price and images; then save the external listing ID and URL."); } async endListing(externalId: string): Promise<void> { void externalId; throw new Error("Manual delist required: end the listing on the marketplace, then confirm its status in Faust OS."); } }
export class MockMarketplaceAdapter implements MarketplaceAdapter {
  constructor(readonly provider: string) {}
  validate(draft: MarketplaceDraft) {
    const slug = this.provider.toLowerCase() as MarketplaceSlug;
    if (!marketplaceSlugs.includes(slug)) return new ManualMarketplaceAdapter().validate(draft);
    const profile = getMarketplaceProfile(slug);
    const errors = [];
    if (!draft.title.trim()) errors.push("Title is required.");
    if (draft.title.length > profile.contentRules.titleMaxLength) errors.push(`${profile.displayName} title must be ${profile.contentRules.titleMaxLength} characters or fewer.`);
    if (draft.description.length < profile.contentRules.descriptionMinLength) errors.push("Description should include material, condition, measurements, and shipping notes.");
    if (!draft.category) errors.push("Category is required.");
    if (draft.imageUrls.length < profile.imageRules.minImages) errors.push(`At least ${profile.imageRules.minImages} image is required.`);
    if (draft.quantity < 0) errors.push("Quantity cannot be negative.");
    const minimum = profile.fieldDefinitions.find((field) => field.key === "price")?.minimum || 0;
    if (draft.price < minimum) errors.push(`Price must be at least $${minimum}.`);
    return errors;
  }
  async publish(draft: MarketplaceDraft): Promise<MarketplacePublishResult> {
    const errors = this.validate(draft);
    if (errors.length) throw new Error(errors.join(" "));
    const externalId = `${this.provider.toUpperCase()}-${draft.listingId.slice(0, 8)}`;
    return { externalId, externalUrl: `https://example.test/${this.provider}/listing/${externalId}`, status: "active", warnings: ["Local marketplace adapter recorded the publish result; connect live credentials before real publishing."] };
  }
  async endListing(externalId: string) { void externalId; }
}
export function getMarketplaceAdapter(provider: string) {
  const slug = provider.toLowerCase() as MarketplaceSlug;
  if (!marketplaceSlugs.includes(slug)) return new ManualMarketplaceAdapter();
  return getMarketplaceProfile(marketplaceForSlug(slug)).capabilities.publishing === "adapter" ? new MockMarketplaceAdapter(slug) : new ManualMarketplaceAdapter();
}
