export type MarketplaceDraft = { listingId: string; title: string; description: string; price: number; quantity: number; imageUrls: string[]; category?: string; condition?: string };
export type MarketplacePublishResult = { externalId: string; externalUrl: string; status: "active" | "pending"; warnings?: string[] };
export interface MarketplaceAdapter { readonly provider: string; validate(draft: MarketplaceDraft): string[]; publish(draft: MarketplaceDraft): Promise<MarketplacePublishResult>; endListing(externalId: string): Promise<void>; importOrders?(cursor?: string): Promise<{ cursor?: string; records: unknown[] }>; }
export class ManualMarketplaceAdapter implements MarketplaceAdapter { readonly provider = "manual"; validate(draft: MarketplaceDraft) { const errors: string[] = []; if (!draft.title.trim()) errors.push("Title is required."); if (draft.price <= 0) errors.push("Price must be greater than zero."); if (draft.quantity < 0) errors.push("Quantity cannot be negative."); return errors; } async publish(draft: MarketplaceDraft): Promise<MarketplacePublishResult> { void draft; throw new Error("Manual publish required: copy the generated title, description, price and images; then save the external listing ID and URL."); } async endListing(externalId: string): Promise<void> { void externalId; throw new Error("Manual delist required: end the listing on the marketplace, then confirm its status in Faust OS."); } }
export class MockMarketplaceAdapter implements MarketplaceAdapter {
  constructor(readonly provider: string) {}
  validate(draft: MarketplaceDraft) {
    const errors = new ManualMarketplaceAdapter().validate(draft);
    if (draft.title.length > 80 && ["depop", "poshmark"].includes(this.provider)) errors.push(`${this.provider} title must be 80 characters or fewer.`);
    if (draft.description.length < 20) errors.push("Description should include material, condition, measurements, and shipping notes.");
    if (!draft.category) errors.push("Category is required.");
    if (!draft.imageUrls.length) errors.push("At least one image is required.");
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
  return ["depop", "ebay"].includes(provider.toLowerCase()) ? new MockMarketplaceAdapter(provider.toLowerCase()) : new ManualMarketplaceAdapter();
}
