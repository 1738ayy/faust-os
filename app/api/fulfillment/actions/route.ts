import { NextResponse } from "next/server";
import { fulfillmentActionSchema } from "@/lib/validation/requests";
import { assignFulfillment, attachExternalShippingLabel, beginPacking, beginPicking, completePacking, completePicking, createFulfillmentManifest, dispatchFulfillmentManifest, dispatchShipment, generateShippingLabel, holdShipment, markShipmentDelivered, markShipmentReturned, overrideShipmentAddress, printShippingLabel, recordFulfillmentException, refreshShipmentTracking, releaseShipmentHold, reopenFulfillmentException, resolveFulfillmentException, selectShipmentRate, shopShipmentRates, validateShipmentAddress, voidShippingLabel } from "@/services/operating-system/repository";

export async function POST(request: Request) {
  try {
    const input = fulfillmentActionSchema.parse(await request.json());
    const data =
      input.action === "begin-picking" ? await beginPicking(input.orderId, input.picker, input.mode) :
      input.action === "complete-picking" ? await completePicking(input.shipmentId, input.outcomes) :
      input.action === "begin-packing" ? await beginPacking(input.shipmentId, input.packer, input.station) :
      input.action === "complete-packing" ? await completePacking(input.shipmentId, input) :
      input.action === "validate-address" ? await validateShipmentAddress(input.shipmentId, input.provider) :
      input.action === "override-address" ? await overrideShipmentAddress(input.shipmentId, input.reason) :
      input.action === "get-rates" ? await shopShipmentRates(input.shipmentId, input.provider, input.insurance, input.signature) :
      input.action === "select-rate" ? await selectShipmentRate(input.shipmentId, input.rateId) :
      input.action === "generate-label" ? await generateShippingLabel(input.shipmentId, input) :
      input.action === "attach-manual-label" ? await attachExternalShippingLabel(input.shipmentId, "manual_label", input) :
      input.action === "attach-marketplace-label" ? await attachExternalShippingLabel(input.shipmentId, "marketplace_label", input) :
      input.action === "print-label" ? await printShippingLabel(input.shipmentId, input.kind) :
      input.action === "void-label" ? await voidShippingLabel(input.shipmentId, input.reason) :
      input.action === "regenerate-label" ? await generateShippingLabel(input.shipmentId, { carrier: "USPS Mock", service: "Ground Advantage", postageCost: 7.45, regenerate: true }) :
      input.action === "refresh-tracking" ? await refreshShipmentTracking(input.shipmentId) :
      input.action === "dispatch" ? await dispatchShipment(input.shipmentId) :
      input.action === "create-manifest" ? await createFulfillmentManifest(input.shipmentIds, input.carrier) :
      input.action === "dispatch-manifest" ? await dispatchFulfillmentManifest(input.manifestId) :
      input.action === "hold-shipment" ? await holdShipment(input.shipmentId, input.reason) :
      input.action === "release-hold" ? await releaseShipmentHold(input.shipmentId) :
      input.action === "assign-fulfillment" ? await assignFulfillment(input.shipmentId, input) :
      input.action === "delivered" ? await markShipmentDelivered(input.shipmentId) :
      input.action === "returned" ? await markShipmentReturned(input.shipmentId, input.notes) :
      input.action === "record-exception" ? await recordFulfillmentException(input) :
      input.action === "resolve-exception" ? await resolveFulfillmentException(input.exceptionId, input.notes) :
      await reopenFulfillmentException(input.exceptionId, input.notes);
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Fulfillment action failed." }, { status: 400 });
  }
}
