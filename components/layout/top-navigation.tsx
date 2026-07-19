export function TopNavigation() {
  return (
    <header className="mb-8 flex items-center justify-between border-b border-red-950/50 pb-6">
      <div>
        <h2 className="font-heading text-xl font-semibold">Mission Control</h2>
        <p className="text-sm text-muted-foreground">One operating language for Faust.</p>
      </div>
      <button className="faust-secondary-action">Search</button>
    </header>
  );
}
