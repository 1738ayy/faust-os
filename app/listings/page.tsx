import { AppLayout } from "@/components/navigation/app-layout";
import { ListingsWorkspace } from "@/components/operations/primary-workspaces";
import { getOperatingData, snapshot } from "@/services/operating-system/repository";
export const dynamic = "force-dynamic";
export default async function ListingsPage() { return <AppLayout><ListingsWorkspace snapshot={snapshot(await getOperatingData())} /></AppLayout>; }
