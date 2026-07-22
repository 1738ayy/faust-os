import { NextResponse } from "next/server";

import { getOpportunities, saveOpportunity } from "@/services/opportunities/local-opportunity-store";
import { ensureInventoryForOpportunity } from "@/services/inventory/local-inventory-store";
import { recordActivity } from "@/services/activity/repository";
import { convertOpportunity } from "@/services/operating-system/repository";
import type { Opportunity } from "@/types/opportunity";

export async function POST(request: Request) {
  try {
    const opportunity = await request.json() as Opportunity;
    if (!opportunity?.id || !opportunity.product?.name) {
      return NextResponse.json({ success: false, message: "A product opportunity is required." }, { status: 400 });
    }

    const operatingData = await convertOpportunity(opportunity);
    const product = operatingData.products.find((entry) => entry.sourceUrl === opportunity.product.sourcing.superbuyUrl);
    const productImages = product ? (operatingData.productImages || []).filter((entry) => entry.productId === product.id) : [];
    const trace = {
      sourceUrl: opportunity.product.sourcing.superbuyUrl,
      queueItemId: "importQueueItemId" in opportunity && typeof opportunity.importQueueItemId === "string" ? opportunity.importQueueItemId : undefined,
      analyzerImageCount: opportunity.product.media.images.length,
      productId: product?.id,
      productImageCount: productImages.length || product?.images?.length || 0,
      coverImage: productImages.find((entry) => entry.isCover)?.url || product?.image,
    };
    console.info("[faust:opportunity-publish]", trace);

    await Promise.allSettled([
      saveOpportunity(opportunity),
      ensureInventoryForOpportunity(opportunity),
      recordActivity({ type: "opportunity_saved", title: "Opportunity saved", detail: opportunity.product.name }),
    ]);

    return NextResponse.json({ success: true, opportunity, product, trace });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : "Unable to save this opportunity." }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ success: true, opportunities: await getOpportunities() });
}
