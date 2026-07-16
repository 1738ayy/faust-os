import assert from "node:assert/strict";
import { EasyPostReadyAdapter, ShippingProviderError, getShippingProvider } from "../services/adapters/shipping";

const originalFetch = globalThis.fetch;
const originalKey = process.env.EASYPOST_API_KEY;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

void (async () => {
  process.env.EASYPOST_API_KEY = "EZTK_unit_test_key";
  const calls: { url: string; body?: string }[] = [];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const href = String(url);
    calls.push({ url: href, body: typeof init?.body === "string" ? init.body : undefined });
    if (href.endsWith("/addresses/create_and_verify")) return jsonResponse({ address: { name: "Jordan", street1: "417 MONTGOMERY ST", street2: "FLOOR 5", city: "SAN FRANCISCO", state: "CA", zip: "94104-1129", country: "US", residential: false } });
    if (href.endsWith("/shipments") && init?.method === "POST") return jsonResponse({ id: "shp_test_123", rates: [{ id: "rate_test_123", carrier: "USPS", service: "GroundAdvantage", rate: "8.20", retail_rate: "13.85", delivery_days: 3 }], messages: [] });
    if (href.endsWith("/shipments/shp_test_123/buy")) return jsonResponse({ id: "shp_test_123", tracking_code: "EZ1000000001", created_at: "2026-01-01T00:00:00Z", selected_rate: { carrier: "USPS", service: "GroundAdvantage", rate: "8.20" }, postage_label: { label_pdf_url: "https://example.test/label.pdf", label_url: "https://example.test/label.png" } });
    if (href.endsWith("/trackers/EZ1000000001")) return jsonResponse({ status: "in_transit", est_delivery_date: "2026-01-04", tracking_details: [{ datetime: "2026-01-01T00:00:00Z", message: "Carrier accepted package", tracking_location: { city: "Richmond", state: "VA" } }] });
    if (href.endsWith("/shipments/shp_test_123/refund")) return jsonResponse({ id: "shp_test_123", refund_status: "submitted" });
    return jsonResponse({ error: { code: "NOT_FOUND", message: "Unhandled mocked EasyPost path" } }, 404);
  }) as typeof fetch;

  const provider = getShippingProvider("easypost");
  assert.equal(provider.capabilities().labelPurchase, true, "EasyPost adapter exposes label purchase capability");
  const validation = await provider.validateAddress({ name: "Jordan", line1: "417 Montgomery St", line2: "Floor 5", city: "San Francisco", region: "CA", postalCode: "94104", country: "US" });
  assert.equal(validation.status, "valid", "EasyPost address verification maps valid responses");
  const rates = await provider.getRates({ shipmentId: "shipment", orderId: "order", address: validation.suggested!, packages: [{ weightOz: 22, lengthIn: 14, widthIn: 10, heightIn: 2 }] });
  assert.equal(rates[0].id, "rate_test_123::shp_test_123", "EasyPost rate ID preserves the shipment ID for later label purchase");
  const label = await provider.buyLabel({ shipmentId: "shipment", orderId: "order", address: validation.suggested!, packages: [{ weightOz: 22, lengthIn: 14, widthIn: 10, heightIn: 2 }], rateId: rates[0].id });
  assert.equal(label.source, "provider", "EasyPost labels are marked as provider labels");
  assert.equal(label.labelUrl, "https://example.test/label.pdf", "EasyPost label PDF URL is preferred when available");
  const tracking = await provider.trackShipment(label.trackingNumber);
  assert.equal(tracking.status, "in_transit", "EasyPost tracking maps carrier status");
  const voided = await provider.voidLabel(label, "unit test void");
  assert.equal(voided.status, "voided", "EasyPost refund submission maps to voided label state");
  assert.ok(calls.every((call) => !call.url.includes("EZTK_unit_test_key") && !call.body?.includes("EZTK_unit_test_key")), "EasyPost API key is not logged or embedded in request bodies");

  globalThis.fetch = (async () => jsonResponse({ error: { code: "ADDRESS.VERIFY.FAILURE", message: "Unable to verify address." } }, 400)) as typeof fetch;
  await assert.rejects(() => provider.validateAddress({ line1: "000 unknown street", city: "Nowhere", region: "ZZ", postalCode: "00001", country: "US" }), (error) => error instanceof ShippingProviderError && error.category === "validation");

  globalThis.fetch = originalFetch;
  process.env.EASYPOST_API_KEY = originalKey;
  console.log("✓ EasyPost adapter mocked unit tests passed");

  if (!process.env.EASYPOST_API_KEY || !/^EZTK/i.test(process.env.EASYPOST_API_KEY)) {
    console.log("↷ EasyPost sandbox integration skipped: EASYPOST_API_KEY test key not present");
    return;
  }
  try {
    const sandboxProvider = new EasyPostReadyAdapter();
    const sandboxAddress = await sandboxProvider.validateAddress({ name: "EasyPost Test", line1: "417 MONTGOMERY ST", line2: "FLOOR 5", city: "SAN FRANCISCO", region: "CA", postalCode: "94104", country: "US" });
    assert.equal(sandboxAddress.status, "valid", "EasyPost sandbox address verification passed");
    const sandboxRates = await sandboxProvider.getRates({ shipmentId: crypto.randomUUID(), orderId: crypto.randomUUID(), address: sandboxAddress.suggested!, packages: [{ weightOz: 16, lengthIn: 10, widthIn: 8, heightIn: 4 }] });
    assert.ok(sandboxRates.length > 0, "EasyPost sandbox returned rates");
    const selected = sandboxRates.sort((a, b) => (a.negotiatedRate || a.retailRate) - (b.negotiatedRate || b.retailRate))[0];
    const sandboxLabel = await sandboxProvider.buyLabel({ shipmentId: crypto.randomUUID(), orderId: crypto.randomUUID(), address: sandboxAddress.suggested!, packages: [{ weightOz: 16, lengthIn: 10, widthIn: 8, heightIn: 4 }], rateId: selected.id, carrier: selected.carrier, service: selected.service, postageCost: selected.negotiatedRate || selected.retailRate });
    assert.ok(sandboxLabel.trackingNumber, "EasyPost sandbox label purchase returned tracking");
    assert.ok(sandboxLabel.labelUrl, "EasyPost sandbox label purchase returned label URL");
    const sandboxTracking = await sandboxProvider.trackShipment(sandboxLabel.trackingNumber);
    assert.ok(["pre_transit", "in_transit", "delivered", "returned", "claim_required"].includes(sandboxTracking.status), "EasyPost sandbox tracking returned supported status");
    const sandboxVoided = await sandboxProvider.voidLabel(sandboxLabel, "staging sandbox verification");
    assert.ok(["voided", "refunded"].includes(sandboxVoided.status), "EasyPost sandbox refund/void was submitted");
    console.log("✓ EasyPost sandbox integration checks passed");
  } catch (error) {
    const detail = error instanceof ShippingProviderError ? `${error.category}${error.status ? ` ${error.status}` : ""}: ${error.message}` : error instanceof Error ? error.message : String(error);
    throw new Error(`EasyPost sandbox integration failed: ${detail}`);
  }
})();
