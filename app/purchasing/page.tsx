import { AppLayout } from "@/components/navigation/app-layout";
import { ModuleWorkspace } from "@/components/operations/module-workspace";
import { getOperatingData, snapshot } from "@/services/operating-system/repository";
export const dynamic = "force-dynamic";
export default async function PurchasingPage() { return <AppLayout><ModuleWorkspace module="purchasing" snapshot={snapshot(await getOperatingData())} /></AppLayout>; }
