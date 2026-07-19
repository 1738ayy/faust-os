import { PackageCheck, Plane, Truck } from "lucide-react";
import { AppLayout } from "@/components/navigation/app-layout";
import { DataCard, PageHeader, StatusBadge } from "@/components/faust/design-system";
import { RecordForm } from "@/components/operations/record-form";
import { ordersRepository } from "@/services/orders/repository";
import { parcelsRepository } from "@/services/parcels/repository";

export default async function LogisticsPage() {
  const [parcels, orders] = await Promise.all([parcelsRepository.all(), ordersRepository.all()]);

  return (
    <AppLayout>
      <div className="space-y-8">
        <PageHeader eyebrow="Logistics" title="Parcel and order movement" description="Track incoming Superbuy parcels and outgoing customer orders in one place." />
        <div className="grid gap-6 lg:grid-cols-2">
          <DataCard title="Incoming parcels" description="Warehouse and international shipments." icon={Plane}>
            <RecordForm endpoint="/api/parcels" submitLabel="Add parcel" fields={[{ name: "trackingNumber", label: "Tracking number", required: true }, { name: "carrier", label: "Carrier" }, { name: "destination", label: "Destination" }, { name: "estimatedArrival", label: "Estimated arrival", type: "date" }]} />
            <div className="mt-5 overflow-hidden rounded-2xl border border-red-950/35 bg-black/35">{parcels.length === 0 ? <p className="p-6 text-sm text-muted-foreground">No parcels recorded.</p> : parcels.map((parcel) => <div key={parcel.id} className="flex justify-between gap-4 border-b border-red-950/35 px-5 py-4 last:border-0"><div><p className="font-medium">{parcel.trackingNumber}</p><p className="text-sm text-muted-foreground">{parcel.carrier || "Carrier not set"}</p></div><StatusBadge value={parcel.status} /></div>)}</div>
          </DataCard>
          <DataCard title="Customer orders" description="Sales, fulfillment, and return status." icon={Truck}>
            <RecordForm endpoint="/api/orders" submitLabel="Add order" fields={[{ name: "customer", label: "Customer", required: true }, { name: "itemName", label: "Item", required: true }, { name: "marketplace", label: "Marketplace" }, { name: "salePrice", label: "Sale price", type: "number" }]} />
            <div className="mt-5 overflow-hidden rounded-2xl border border-red-950/35 bg-black/35">{orders.length === 0 ? <p className="p-6 text-sm text-muted-foreground">No customer orders recorded.</p> : orders.map((order) => <div key={order.id} className="flex justify-between gap-4 border-b border-red-950/35 px-5 py-4 last:border-0"><div><p className="font-medium">{order.itemName}</p><p className="text-sm text-muted-foreground">{order.customer} · {order.marketplace}</p></div><div className="text-right"><p className="font-semibold tabular-nums">${order.salePrice.toFixed(2)}</p><div className="mt-1"><StatusBadge value={order.status} /></div></div></div>)}</div>
          </DataCard>
        </div>
        <DataCard title="Superbuy warehouse connection" description="Warehouse inventory, package photos, consolidation, and live tracking are ready to connect through a future Superbuy account integration." icon={PackageCheck}>
          <p className="text-sm leading-6 text-muted-foreground">The local parcel model already supports the data Faust needs for incoming shipment visibility.</p>
        </DataCard>
      </div>
    </AppLayout>
  );
}
