export type ShippingProviderCapabilities = {
  addressValidation: boolean;
  rates: boolean;
  labelPurchase: boolean;
  labelVoid: boolean;
  tracking: boolean;
  insurance: boolean;
  signature: boolean;
  internationalCustoms: boolean;
};

export type ShippingProviderKey = "local_mock" | "manual_label" | "marketplace_label" | "easypost" | "shippo";
export type ShippingAddress = { name?: string; line1: string; line2?: string; city: string; region?: string; postalCode: string; country: string };
export type AddressValidationResult = { status: "valid" | "invalid" | "warning" | "overridden"; original: ShippingAddress; suggested?: ShippingAddress; warnings: string[]; residential: boolean; confirmedAt?: string; overrideReason?: string };
export type PackageDimensions = { weightOz: number; lengthIn: number; widthIn: number; heightIn: number; packageType?: "poly_mailer" | "box" | "custom" };
export type RateRequest = { shipmentId: string; orderId: string; address: ShippingAddress; packages: PackageDimensions[]; insurance?: boolean; signature?: boolean };
export type ShippingRateOption = { id: string; provider: ShippingProviderKey; carrier: string; service: string; deliveryDays: number; retailRate: number; negotiatedRate?: number; currency: "USD"; insuranceAvailable: boolean; signatureAvailable: boolean; warnings: string[]; packageWeightOz: number; dimensions: { lengthIn: number; widthIn: number; heightIn: number } };
export type LabelPurchaseRequest = RateRequest & { rateId?: string; carrier?: string; service?: string; postageCost?: number; format?: "4x6" | "letter"; externalLabelUrl?: string; externalTrackingNumber?: string };
export type ShippingLabelRecord = { id: string; provider: ShippingProviderKey; carrier: string; service: string; trackingNumber: string; labelUrl: string; format: "4x6" | "letter"; status: "active" | "voided" | "refunded" | "regenerated"; postageCost: number; createdAt: string; voidedAt?: string; regeneratedFromLabelId?: string; source: "mock" | "manual_upload" | "marketplace" | "provider" };
export type TrackingResult = { status: "pre_transit" | "in_transit" | "delivered" | "delayed" | "returned" | "lost" | "claim_required"; lastScan?: string; estimatedDelivery?: string; actualDelivery?: string; events: Array<{ occurredAt: string; label: string; location?: string }> };

export interface ShippingProviderAdapter {
  readonly provider: ShippingProviderKey;
  capabilities(): ShippingProviderCapabilities;
  validateAddress(address: ShippingAddress): Promise<AddressValidationResult>;
  getRates(request: RateRequest): Promise<ShippingRateOption[]>;
  buyLabel(request: LabelPurchaseRequest): Promise<ShippingLabelRecord>;
  voidLabel(label: ShippingLabelRecord, reason?: string): Promise<ShippingLabelRecord>;
  regenerateLabel(label: ShippingLabelRecord, request: LabelPurchaseRequest): Promise<ShippingLabelRecord>;
  trackShipment(trackingNumber: string): Promise<TrackingResult>;
}

const unsupported = (provider: ShippingProviderKey, action: string) => new Error(`${provider} is provider-ready for ${action}, but credentials/live carrier verification are not connected yet.`);
const today = () => new Date().toISOString();
const stableHash = (value: string) => Array.from(value).reduce((sum, char) => sum + char.charCodeAt(0), 0);
const printableUrl = (trackingNumber: string, format: "4x6" | "letter") => `/api/fulfillment/labels/${trackingNumber}?format=${format}`;

function baseCapabilities(overrides: Partial<ShippingProviderCapabilities>): ShippingProviderCapabilities {
  return { addressValidation: false, rates: false, labelPurchase: false, labelVoid: false, tracking: false, insurance: false, signature: false, internationalCustoms: false, ...overrides };
}

export class LocalMockShippingProvider implements ShippingProviderAdapter {
  readonly provider: ShippingProviderKey = "local_mock";
  capabilities() { return baseCapabilities({ addressValidation: true, rates: true, labelPurchase: true, labelVoid: true, tracking: true, insurance: true, signature: true, internationalCustoms: false }); }
  async validateAddress(address: ShippingAddress): Promise<AddressValidationResult> {
    const warnings: string[] = [];
    if (!address.line1 || !address.city || !address.postalCode || !address.country) warnings.push("Street, city, postal code, and country are required.");
    if (address.country !== "US") warnings.push("Demo provider only validates domestic US labels.");
    const suggested = { ...address, region: address.region?.toUpperCase(), postalCode: address.postalCode.trim() };
    return { status: warnings.length ? "invalid" : "valid", original: address, suggested, warnings, residential: !/suite|ste|unit|warehouse|dock/i.test(`${address.line1} ${address.line2 || ""}`), confirmedAt: warnings.length ? undefined : today() };
  }
  async getRates(request: RateRequest): Promise<ShippingRateOption[]> {
    if (!request.packages.length) throw new Error("At least one package is required for rate shopping.");
    const weight = request.packages.reduce((sum, pack) => sum + pack.weightOz, 0);
    const first = request.packages[0];
    const dimensionalWarning = first.lengthIn > 18 || first.widthIn > 14 || first.heightIn > 8 ? ["Dimensional weight may apply."] : [];
    const base = Math.max(4.75, 5.2 + weight * 0.085 + request.packages.length * 0.55);
    return [
      { id: `rate-local-usps-ground-${request.shipmentId}`, provider: this.provider, carrier: "USPS Mock", service: "Ground Advantage", deliveryDays: 3, retailRate: Number((base + 1.05).toFixed(2)), negotiatedRate: Number(base.toFixed(2)), currency: "USD", insuranceAvailable: true, signatureAvailable: true, warnings: dimensionalWarning, packageWeightOz: weight, dimensions: { lengthIn: first.lengthIn, widthIn: first.widthIn, heightIn: first.heightIn } },
      { id: `rate-local-ups-ground-${request.shipmentId}`, provider: this.provider, carrier: "UPS Mock", service: "Ground", deliveryDays: 4, retailRate: Number((base + 2.95).toFixed(2)), negotiatedRate: Number((base + 1.4).toFixed(2)), currency: "USD", insuranceAvailable: true, signatureAvailable: true, warnings: dimensionalWarning, packageWeightOz: weight, dimensions: { lengthIn: first.lengthIn, widthIn: first.widthIn, heightIn: first.heightIn } },
      { id: `rate-local-usps-priority-${request.shipmentId}`, provider: this.provider, carrier: "USPS Mock", service: "Priority Mail", deliveryDays: 2, retailRate: Number((base + 5.5).toFixed(2)), negotiatedRate: Number((base + 3.85).toFixed(2)), currency: "USD", insuranceAvailable: true, signatureAvailable: true, warnings: ["Fastest deterministic demo rate."], packageWeightOz: weight, dimensions: { lengthIn: first.lengthIn, widthIn: first.widthIn, heightIn: first.heightIn } },
    ];
  }
  async buyLabel(request: LabelPurchaseRequest): Promise<ShippingLabelRecord> {
    const carrier = request.carrier || "USPS Mock";
    const service = request.service || "Ground Advantage";
    const trackingNumber = `MOCK-${request.orderId.slice(0, 8).toUpperCase()}-${stableHash(`${request.shipmentId}${carrier}${service}`)}`;
    return { id: `label-${trackingNumber}`, provider: this.provider, carrier, service, trackingNumber, labelUrl: printableUrl(trackingNumber, request.format || "4x6"), format: request.format || "4x6", status: "active", postageCost: request.postageCost ?? 7.45, createdAt: today(), source: "mock" };
  }
  async voidLabel(label: ShippingLabelRecord, reason = "Voided from Faust OS"): Promise<ShippingLabelRecord> {
    void reason;
    return { ...label, status: "voided", voidedAt: today() };
  }
  async regenerateLabel(label: ShippingLabelRecord, request: LabelPurchaseRequest): Promise<ShippingLabelRecord> {
    const replacement = await this.buyLabel({ ...request, service: request.service || label.service, carrier: request.carrier || label.carrier });
    return { ...replacement, id: `${replacement.id}-regen`, trackingNumber: `${replacement.trackingNumber}-R`, labelUrl: printableUrl(`${replacement.trackingNumber}-R`, request.format || label.format), status: "regenerated", regeneratedFromLabelId: label.id };
  }
  async trackShipment(trackingNumber: string): Promise<TrackingResult> {
    const delay = trackingNumber.includes("DELAY");
    return { status: delay ? "delayed" : "in_transit", lastScan: delay ? "Carrier delay detected" : "Carrier accepted package", estimatedDelivery: new Date(Date.now() + (delay ? 5 : 3) * 86400000).toISOString(), events: [{ occurredAt: today(), label: delay ? "Carrier delay detected" : "Carrier accepted package", location: "Richmond, VA" }, { occurredAt: new Date(Date.now() - 3600000).toISOString(), label: "Label created", location: "Warehouse" }] };
  }
}

export class ManualLabelProvider extends LocalMockShippingProvider {
  readonly provider: ShippingProviderKey = "manual_label";
  capabilities() { return baseCapabilities({ labelPurchase: true, labelVoid: true, tracking: true }); }
  async getRates(): Promise<ShippingRateOption[]> { return []; }
  async buyLabel(request: LabelPurchaseRequest): Promise<ShippingLabelRecord> {
    if (!request.externalTrackingNumber || !request.externalLabelUrl) throw new Error("Manual labels require a tracking number and label URL.");
    return { id: `manual-${request.externalTrackingNumber}`, provider: this.provider, carrier: request.carrier || "Manual carrier", service: request.service || "Manual service", trackingNumber: request.externalTrackingNumber, labelUrl: request.externalLabelUrl, format: request.format || "4x6", status: "active", postageCost: request.postageCost || 0, createdAt: today(), source: "manual_upload" };
  }
}

export class MarketplaceLabelProvider extends ManualLabelProvider {
  readonly provider: ShippingProviderKey = "marketplace_label";
  async buyLabel(request: LabelPurchaseRequest): Promise<ShippingLabelRecord> {
    const label = await super.buyLabel({ ...request, carrier: request.carrier || "Marketplace", service: request.service || "Marketplace label" });
    return { ...label, provider: this.provider, source: "marketplace" };
  }
}

export class EasyPostReadyAdapter extends LocalMockShippingProvider {
  readonly provider: ShippingProviderKey = "easypost";
  capabilities() { return baseCapabilities({ addressValidation: true, rates: true, labelPurchase: true, labelVoid: true, tracking: true, insurance: true, signature: true, internationalCustoms: true }); }
  async validateAddress(address: ShippingAddress): Promise<AddressValidationResult> { if (!process.env.EASYPOST_API_KEY) throw unsupported(this.provider, "address validation"); return super.validateAddress(address); }
  async getRates(request: RateRequest): Promise<ShippingRateOption[]> { if (!process.env.EASYPOST_API_KEY) throw unsupported(this.provider, "rates"); return super.getRates(request); }
  async buyLabel(request: LabelPurchaseRequest): Promise<ShippingLabelRecord> { if (!process.env.EASYPOST_API_KEY) throw unsupported(this.provider, "label purchase"); return super.buyLabel(request); }
  async voidLabel(label: ShippingLabelRecord, reason?: string): Promise<ShippingLabelRecord> { if (!process.env.EASYPOST_API_KEY) throw unsupported(this.provider, "label void"); return super.voidLabel(label, reason); }
  async regenerateLabel(label: ShippingLabelRecord, request: LabelPurchaseRequest): Promise<ShippingLabelRecord> { if (!process.env.EASYPOST_API_KEY) throw unsupported(this.provider, "label regeneration"); return super.regenerateLabel(label, request); }
  async trackShipment(trackingNumber: string): Promise<TrackingResult> { if (!process.env.EASYPOST_API_KEY) throw unsupported(this.provider, "tracking"); return super.trackShipment(trackingNumber); }
}

export class ShippoReadyAdapter extends EasyPostReadyAdapter {
  readonly provider: ShippingProviderKey = "shippo";
  async validateAddress(address: ShippingAddress): Promise<AddressValidationResult> { if (!process.env.SHIPPO_API_KEY) throw unsupported(this.provider, "address validation"); return LocalMockShippingProvider.prototype.validateAddress.call(this, address); }
  async getRates(request: RateRequest): Promise<ShippingRateOption[]> { if (!process.env.SHIPPO_API_KEY) throw unsupported(this.provider, "rates"); return LocalMockShippingProvider.prototype.getRates.call(this, request); }
  async buyLabel(request: LabelPurchaseRequest): Promise<ShippingLabelRecord> { if (!process.env.SHIPPO_API_KEY) throw unsupported(this.provider, "label purchase"); return LocalMockShippingProvider.prototype.buyLabel.call(this, request); }
  async voidLabel(label: ShippingLabelRecord, reason?: string): Promise<ShippingLabelRecord> { if (!process.env.SHIPPO_API_KEY) throw unsupported(this.provider, "label void"); return LocalMockShippingProvider.prototype.voidLabel.call(this, label, reason); }
  async regenerateLabel(label: ShippingLabelRecord, request: LabelPurchaseRequest): Promise<ShippingLabelRecord> { if (!process.env.SHIPPO_API_KEY) throw unsupported(this.provider, "label regeneration"); return LocalMockShippingProvider.prototype.regenerateLabel.call(this, label, request); }
  async trackShipment(trackingNumber: string): Promise<TrackingResult> { if (!process.env.SHIPPO_API_KEY) throw unsupported(this.provider, "tracking"); return LocalMockShippingProvider.prototype.trackShipment.call(this, trackingNumber); }
}

export function getShippingProvider(provider: ShippingProviderKey = "local_mock"): ShippingProviderAdapter {
  if (provider === "manual_label") return new ManualLabelProvider();
  if (provider === "marketplace_label") return new MarketplaceLabelProvider();
  if (provider === "easypost") return new EasyPostReadyAdapter();
  if (provider === "shippo") return new ShippoReadyAdapter();
  return new LocalMockShippingProvider();
}

export const easyPostAdapterConfig = { provider: "easypost", requiredEnvironment: ["EASYPOST_API_KEY"] } as const;
export const shippoAdapterConfig = { provider: "shippo", requiredEnvironment: ["SHIPPO_API_KEY"] } as const;
