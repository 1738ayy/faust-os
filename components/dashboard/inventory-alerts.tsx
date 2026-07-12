export function InventoryAlerts() {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <h2 className="text-lg font-semibold">Inventory Alerts</h2>

      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between rounded-lg bg-zinc-800 p-3">
          <span>Dog Tags</span>
          <span className="text-yellow-400">14 Left</span>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-zinc-800 p-3">
          <span>Tooth Necklaces</span>
          <span className="text-green-400">In Stock</span>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-zinc-800 p-3">
          <span>Nameplates</span>
          <span className="text-red-400">Out of Stock</span>
        </div>
      </div>
    </div>
  );
}