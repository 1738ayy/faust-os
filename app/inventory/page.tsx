import { AppLayout } from "@/components/navigation/app-layout";
import { InventoryWorkspace } from "@/components/operations/primary-workspaces";
import { InventoryMutationPanel } from "@/components/operations/inventory-mutation-panel";
import { InventoryDetail } from "@/components/operations/inventory-detail";
import { getOperatingData, snapshot } from "@/services/operating-system/repository";
export const dynamic = "force-dynamic";
export default async function InventoryPage() { const state = snapshot(await getOperatingData()); return <AppLayout><div className="space-y-6"><InventoryMutationPanel balances={state.data.balances} locations={state.data.locations} /><InventoryDetail data={state.data} /><InventoryWorkspace snapshot={state} /></div></AppLayout>; }
