import { AppLayout } from "@/components/navigation/app-layout";
import { OrdersDeepeningPanel } from "@/components/operations/orders-deepening-panel";
import { OrderDetail } from "@/components/operations/order-detail";
import { OrderImportWorkspace } from "@/components/operations/order-import-workspace";
import { getOperatingData, snapshot } from "@/services/operating-system/repository";
export const dynamic = "force-dynamic";
export default async function OrdersPage() { const state = snapshot(await getOperatingData()); return <AppLayout><div className="space-y-6"><OrdersDeepeningPanel orders={state.data.orders} variants={state.data.variants} /><OrderImportWorkspace /><OrderDetail data={state.data} /></div></AppLayout>; }
