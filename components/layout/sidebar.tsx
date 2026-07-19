const items = ["Dashboard", "Products", "Operations", "Finance", "Intelligence", "Logistics", "Settings"];

export function Sidebar() {
  return (
    <aside className="h-screen w-64 border-r border-red-950/50 bg-black/35 p-6 text-white backdrop-blur-xl">
      <h1 className="font-heading text-2xl font-semibold">Faust OS</h1>
      <p className="mt-1 text-sm text-muted-foreground">Business Operating System</p>
      <nav className="mt-10 space-y-2">
        {items.map((item) => <button key={item} className="w-full rounded-2xl px-4 py-3 text-left text-sm text-zinc-300 transition hover:bg-red-950/20 hover:text-white">{item}</button>)}
      </nav>
    </aside>
  );
}
