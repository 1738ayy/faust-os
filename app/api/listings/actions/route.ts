import { NextResponse } from "next/server";
import { listingsActionSchema } from "@/lib/validation/requests";
import { getListingsSummary, getOperatingData, mutateListings, snapshot } from "@/services/operating-system/repository";

export async function GET() {
  return NextResponse.json({ ...snapshot(await getOperatingData()), listingsCore: await getListingsSummary() });
}

export async function POST(request: Request) {
  try {
    const body = listingsActionSchema.parse(await request.json());
    const data = await mutateListings(body.action, body);
    return NextResponse.json({ ...snapshot(data), listingsCore: await getListingsSummary() });
  } catch (error) {
    return NextResponse.json({ message: error instanceof Error ? error.message : "Listings operation failed." }, { status: 400 });
  }
}
