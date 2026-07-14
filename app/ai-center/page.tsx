import { AppLayout } from "@/components/navigation/app-layout";
import { AiWorkspace } from "@/components/operations/primary-workspaces";
import { getOperatingData, snapshot } from "@/services/operating-system/repository";
export const dynamic = "force-dynamic";
export default async function AiCenterPage() { return <AppLayout><AiWorkspace snapshot={snapshot(await getOperatingData())} /></AppLayout>; }
