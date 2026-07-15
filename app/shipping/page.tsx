import { AppLayout } from "@/components/navigation/app-layout";
import { FulfillmentCenter } from "@/components/operations/fulfillment-center";
import { getOperatingData } from "@/services/operating-system/repository";
export const dynamic = "force-dynamic";
export default async function ShippingPage() { return <AppLayout><FulfillmentCenter data={await getOperatingData()} /></AppLayout>; }
