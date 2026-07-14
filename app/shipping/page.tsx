import { AppLayout } from "@/components/navigation/app-layout";
import { ShippingWorkspace } from "@/components/operations/primary-workspaces";
import { getOperatingData, snapshot } from "@/services/operating-system/repository";
export const dynamic = "force-dynamic";
export default async function ShippingPage() { return <AppLayout><ShippingWorkspace snapshot={snapshot(await getOperatingData())} /></AppLayout>; }
