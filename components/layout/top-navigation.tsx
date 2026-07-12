export function TopNavigation() {
  return (
    <header className="mb-8 flex items-center justify-between border-b border-zinc-800 pb-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-1 text-zinc-400">
          Welcome back, Henrry.
        </p>
      </div>

      <div className="flex items-center gap-4">
        <button className="rounded-lg border border-zinc-700 px-3 py-2 hover:bg-zinc-800">
          🔔
        </button>

        <div className="rounded-lg border border-zinc-700 px-4 py-2">
          Henrry
        </div>
      </div>
    </header>
  );
}