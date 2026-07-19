import { AppLayout } from "@/components/navigation/app-layout";
import { InventoryMutationPanel } from "@/components/operations/inventory-mutation-panel";
import { InventoryDetail } from "@/components/operations/inventory-detail";
import { ModuleWorkspace } from "@/components/operations/module-workspace";
import { getOperatingData, snapshot } from "@/services/operating-system/repository";
export const dynamic = "force-dynamic";
export default async function InventoryPage() { const state = snapshot(await getOperatingData()); return <AppLayout><div className="space-y-6"><ModuleWorkspace module="inventory" snapshot={state} /><InventoryMutationPanel balances={state.data.balances} locations={state.data.locations} /><InventoryDetail data={state.data} /></div></AppLayout>; }
