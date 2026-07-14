import { AppLayout } from "@/components/navigation/app-layout";
import { AnalyticsWorkspace } from "@/components/operations/primary-workspaces";
import { getOperatingData, snapshot } from "@/services/operating-system/repository";
export const dynamic = "force-dynamic";
export default async function AnalyticsPage() { return <AppLayout><AnalyticsWorkspace snapshot={snapshot(await getOperatingData())} /></AppLayout>; }
