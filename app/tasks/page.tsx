import { AppLayout } from "@/components/navigation/app-layout";
import { ModuleWorkspace } from "@/components/operations/module-workspace";
import { getOperatingData, snapshot } from "@/services/operating-system/repository";
export const dynamic = "force-dynamic";
export default async function TasksPage() { return <AppLayout><ModuleWorkspace module="tasks" snapshot={snapshot(await getOperatingData())} /></AppLayout>; }
