import { AppLayout } from "@/components/navigation/app-layout";
import { FinanceWorkspace } from "@/components/operations/primary-workspaces";
import { getOperatingData, snapshot } from "@/services/operating-system/repository";
export const dynamic = "force-dynamic";
export default async function FinancePage() { return <AppLayout><FinanceWorkspace snapshot={snapshot(await getOperatingData())} /></AppLayout>; }
