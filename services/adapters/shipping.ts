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
export type ShippingProviderErrorCategory = "configuration" | "authentication" | "validation" | "rate_limit" | "timeout" | "network" | "provider";

export class ShippingProviderError extends Error {
  constructor(readonly provider: ShippingProviderKey, readonly category: ShippingProviderErrorCategory, message: string, readonly status?: number) {
    super(message);
    this.name = "ShippingProviderError";
  }
}

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

const unsupported = (provider: ShippingProviderKey, action: string) => new ShippingProviderError(provider, "configuration", `${provider} is provider-ready for ${action}, but credentials/live carrier verification are not connected yet.`);
const today = () => new Date().toISOString();
const stableHash = (value: string) => Array.from(value).reduce((sum, char) => sum + char.charCodeAt(0), 0);
const printableUrl = (trackingNumber: string, format: "4x6" | "letter") => `/api/fulfillment/labels/${trackingNumber}?format=${format}`;
const EASYPOST_API_BASE = "https://api.easypost.com/v2";
const EASYPOST_TIMEOUT_MS = 15000;

function baseCapabilities(overrides: Partial<ShippingProviderCapabilities>): ShippingProviderCapabilities {
  return { addressValidation: false, rates: false, labelPurchase: false, labelVoid: false, tracking: false, insurance: false, signature: false, internationalCustoms: false, ...overrides };
}

export class LocalMockShippingProvider implements ShippingProviderAdapter {
  readonly provider: ShippingProviderKey = "local_mock";
  capabilities() { return baseCapabilities({ addressValidation: true, rates: true, labelPurchase: true, labelVoid: true, tracking: true, insurance: true, signature: true, internationalCustoms: false }); }
  async validateAddress(address: ShippingAddress): Promise<AddressValidationResult> {
    const warnings: string[] = [];
    if (!address.line1 || !address.city || !address.postalCode || !address.country) warnings.push("Street, city, postal code, and country are required.");
    if (address.country !== "US") warnings.push("Local shipping validation currently supports domestic US labels.");
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
      { id: `rate-local-usps-priority-${request.shipmentId}`, provider: this.provider, carrier: "USPS Mock", service: "Priority Mail", deliveryDays: 2, retailRate: Number((base + 5.5).toFixed(2)), negotiatedRate: Number((base + 3.85).toFixed(2)), currency: "USD", insuranceAvailable: true, signatureAvailable: true, warnings: ["Fastest local test rate."], packageWeightOz: weight, dimensions: { lengthIn: first.lengthIn, widthIn: first.widthIn, heightIn: first.heightIn } },
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
  private key() {
    const key = process.env.EASYPOST_API_KEY;
    if (!key) throw unsupported(this.provider, "sandbox API access");
    if (!/^EZTK/i.test(key)) throw new ShippingProviderError(this.provider, "configuration", "EasyPost sandbox verification requires a test API key beginning with EZTK.");
    return key;
  }
  private authHeader() { return `Basic ${Buffer.from(`${this.key()}:`).toString("base64")}`; }
  private async request<T>(path: string, init: RequestInit = {}, attempt = 0): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), EASYPOST_TIMEOUT_MS);
    try {
      const response = await fetch(`${EASYPOST_API_BASE}${path}`, {
        ...init,
        signal: controller.signal,
        headers: { "Authorization": this.authHeader(), "Content-Type": "application/json", ...(init.headers || {}) },
      });
      const text = await response.text();
      const parsed = text ? JSON.parse(text) as Record<string, unknown> : {};
      if (!response.ok) {
        if ([429, 500, 502, 503, 504].includes(response.status) && attempt < 2) return this.request<T>(path, init, attempt + 1);
        const error = parsed.error as { code?: string; message?: string } | undefined;
        throw new ShippingProviderError(this.provider, this.classifyStatus(response.status, error?.code), error?.message || `EasyPost request failed with ${response.status}.`, response.status);
      }
      return parsed as T;
    } catch (error) {
      if (error instanceof ShippingProviderError) throw error;
      const message = error instanceof Error ? error.message : "EasyPost network request failed.";
      if (/abort/i.test(message)) throw new ShippingProviderError(this.provider, "timeout", "EasyPost request timed out.");
      if (attempt < 2) return this.request<T>(path, init, attempt + 1);
      throw new ShippingProviderError(this.provider, "network", message);
    } finally {
      clearTimeout(timeout);
    }
  }
  private classifyStatus(status: number, code?: string): ShippingProviderErrorCategory {
    if (status === 401 || status === 403) return "authentication";
    if (status === 400 || code?.includes("ADDRESS") || code?.includes("VALIDATION")) return "validation";
    if (status === 429) return "rate_limit";
    return "provider";
  }
  private toEasyPostAddress(address: ShippingAddress) {
    return { name: address.name || "Faust Staging", street1: address.line1, street2: address.line2, city: address.city, state: address.region, zip: address.postalCode, country: address.country, phone: "5555555555", email: "staging@example.test" };
  }
  private fromAddress() {
    return { name: "Faust Staging Warehouse", company: "Faust OS", street1: "417 MONTGOMERY ST", street2: "FLOOR 5", city: "SAN FRANCISCO", state: "CA", zip: "94104", country: "US", phone: "4151234567", email: "staging@example.test" };
  }
  private parcel(packages: PackageDimensions[]) {
    const first = packages[0];
    if (!first) throw new ShippingProviderError(this.provider, "validation", "At least one package is required for EasyPost rates.");
    return { length: first.lengthIn, width: first.widthIn, height: first.heightIn, weight: packages.reduce((sum, pack) => sum + pack.weightOz, 0) };
  }
  private rateIdParts(rateId?: string) {
    const [rateIdOnly, shipmentId] = (rateId || "").split("::");
    return { rateId: rateIdOnly, shipmentId };
  }
  async validateAddress(address: ShippingAddress): Promise<AddressValidationResult> {
    const result = await this.request<{ address: Record<string, unknown> }>("/addresses/create_and_verify", { method: "POST", body: JSON.stringify({ address: this.toEasyPostAddress(address) }) });
    const verified = result.address;
    return { status: "valid", original: address, suggested: { name: String(verified.name || address.name || ""), line1: String(verified.street1 || address.line1), line2: verified.street2 ? String(verified.street2) : undefined, city: String(verified.city || address.city), region: verified.state ? String(verified.state) : undefined, postalCode: String(verified.zip || address.postalCode), country: String(verified.country || address.country) }, warnings: [], residential: Boolean(verified.residential), confirmedAt: today() };
  }
  async getRates(request: RateRequest): Promise<ShippingRateOption[]> {
    const shipment = await this.request<{ id: string; rates?: Array<Record<string, unknown>>; messages?: Array<{ message?: string }> }>("/shipments", { method: "POST", body: JSON.stringify({ shipment: { to_address: this.toEasyPostAddress(request.address), from_address: this.fromAddress(), parcel: this.parcel(request.packages), options: { label_format: "PDF" } } }) });
    const first = request.packages[0];
    return (shipment.rates || []).map((rate) => ({ id: `${String(rate.id)}::${shipment.id}`, provider: this.provider, carrier: String(rate.carrier || "EasyPost"), service: String(rate.service || "Service"), deliveryDays: Number(rate.delivery_days || rate.est_delivery_days || 0), retailRate: Number(rate.retail_rate || rate.rate || 0), negotiatedRate: Number(rate.rate || rate.list_rate || rate.retail_rate || 0), currency: "USD" as const, insuranceAvailable: true, signatureAvailable: true, warnings: (shipment.messages || []).map((message) => message.message || "EasyPost carrier message").filter(Boolean), packageWeightOz: request.packages.reduce((sum, pack) => sum + pack.weightOz, 0), dimensions: { lengthIn: first.lengthIn, widthIn: first.widthIn, heightIn: first.heightIn } }));
  }
  async buyLabel(request: LabelPurchaseRequest): Promise<ShippingLabelRecord> {
    const parts = this.rateIdParts(request.rateId);
    let shipmentId = parts.shipmentId;
    let rateId = parts.rateId;
    if (!shipmentId || !rateId) {
      const rates = await this.getRates(request);
      const selected = rates.sort((a, b) => (a.negotiatedRate || a.retailRate) - (b.negotiatedRate || b.retailRate))[0];
      if (!selected) throw new ShippingProviderError(this.provider, "provider", "EasyPost returned no rates to buy.");
      ({ rateId, shipmentId } = this.rateIdParts(selected.id));
    }
    const bought = await this.request<Record<string, unknown>>(`/shipments/${shipmentId}/buy`, { method: "POST", body: JSON.stringify({ rate: { id: rateId }, insurance: request.insurance ? "100.00" : undefined }) });
    const label = bought.postage_label as Record<string, unknown> | undefined;
    const labelUrl = String(label?.label_pdf_url || label?.label_url || "");
    return { id: String(bought.id), provider: this.provider, carrier: String((bought.selected_rate as Record<string, unknown> | undefined)?.carrier || request.carrier || "EasyPost"), service: String((bought.selected_rate as Record<string, unknown> | undefined)?.service || request.service || "EasyPost"), trackingNumber: String(bought.tracking_code || ""), labelUrl, format: label?.label_pdf_url ? "letter" : request.format || "4x6", status: "active", postageCost: Number((bought.selected_rate as Record<string, unknown> | undefined)?.rate || request.postageCost || 0), createdAt: String(bought.created_at || today()), source: "provider" };
  }
  async voidLabel(label: ShippingLabelRecord, reason = "Voided from Faust OS"): Promise<ShippingLabelRecord> {
    void reason;
    const refunded = await this.request<Record<string, unknown>>(`/shipments/${label.id}/refund`, { method: "POST" });
    const refundStatus = String(refunded.refund_status || "submitted");
    return { ...label, status: refundStatus === "refunded" ? "refunded" : "voided", voidedAt: today() };
  }
  async regenerateLabel(label: ShippingLabelRecord, request: LabelPurchaseRequest): Promise<ShippingLabelRecord> {
    const replacement = await this.buyLabel({ ...request, service: request.service || label.service, carrier: request.carrier || label.carrier });
    return { ...replacement, status: "regenerated", regeneratedFromLabelId: label.id };
  }
  async trackShipment(trackingNumber: string): Promise<TrackingResult> {
    const tracker = await this.request<Record<string, unknown>>(`/trackers/${trackingNumber}`, { method: "GET" });
    const details = Array.isArray(tracker.tracking_details) ? tracker.tracking_details as Array<Record<string, unknown>> : [];
    const status = String(tracker.status || "pre_transit");
    return { status: status === "delivered" ? "delivered" : status === "return_to_sender" ? "returned" : status === "failure" || status === "error" ? "claim_required" : status === "in_transit" || status === "out_for_delivery" ? "in_transit" : "pre_transit", lastScan: details[0]?.message ? String(details[0].message) : undefined, estimatedDelivery: tracker.est_delivery_date ? String(tracker.est_delivery_date) : undefined, events: details.map((event) => ({ occurredAt: String(event.datetime || today()), label: String(event.message || event.status || "Tracking event"), location: [event.tracking_location && typeof event.tracking_location === "object" ? (event.tracking_location as Record<string, unknown>).city : undefined, event.tracking_location && typeof event.tracking_location === "object" ? (event.tracking_location as Record<string, unknown>).state : undefined].filter(Boolean).join(", ") || undefined })) };
  }
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
