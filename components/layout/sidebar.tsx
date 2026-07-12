export function Sidebar() {
  return (
    <aside className="w-64 h-screen bg-zinc-950 border-r border-zinc-800 text-white p-6">
      <h1 className="text-2xl font-bold">Faust OS</h1>

      <p className="mt-1 text-sm text-zinc-500">
        Business Operating System
      </p>

      <nav className="mt-10 space-y-2">
        <button className="w-full rounded-lg px-4 py-3 text-left hover:bg-zinc-800 transition">
          Dashboard
        </button>

        <button className="w-full rounded-lg px-4 py-3 text-left hover:bg-zinc-800 transition">
          Catalog
        </button>

        <button className="w-full rounded-lg px-4 py-3 text-left hover:bg-zinc-800 transition">
          Operations
        </button>

        <button className="w-full rounded-lg px-4 py-3 text-left hover:bg-zinc-800 transition">
          Finance
        </button>

        <button className="w-full rounded-lg px-4 py-3 text-left hover:bg-zinc-800 transition">
          Intelligence
        </button>

        <button className="w-full rounded-lg px-4 py-3 text-left hover:bg-zinc-800 transition">
          Logistics
        </button>

        <button className="w-full rounded-lg px-4 py-3 text-left hover:bg-zinc-800 transition">
         Settings
        </button>
      </nav>
    </aside>
  );
}