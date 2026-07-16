import { AppLayout } from "@/components/navigation/app-layout";
import { AiCenterWorkspace } from "@/components/operations/ai-center-workspace";
import { getOperatingData, snapshot } from "@/services/operating-system/repository";
export const dynamic = "force-dynamic";
export default async function AiCenterPage() { return <AppLayout><AiCenterWorkspace snapshot={snapshot(await getOperatingData())} /></AppLayout>; }
