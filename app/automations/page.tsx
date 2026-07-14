import { AppLayout } from "@/components/navigation/app-layout";
import { AutomationsWorkspace } from "@/components/operations/primary-workspaces";
import { getOperatingData, snapshot } from "@/services/operating-system/repository";
export const dynamic = "force-dynamic";
export default async function AutomationsPage() { return <AppLayout><AutomationsWorkspace snapshot={snapshot(await getOperatingData())} /></AppLayout>; }
