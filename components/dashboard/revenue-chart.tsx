export function RevenueChart() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return <div className="faust-surface p-6"><div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-semibold">Revenue Analytics</h2><p className="text-sm text-muted-foreground">Last 7 Days</p></div><div className="text-right"><p className="font-heading text-2xl font-semibold">$0.00</p><p className="text-sm text-muted-foreground">Waiting for orders</p></div></div><div className="mt-8 flex h-48 items-end justify-between gap-3">{days.map((day) => <div key={day} className="flex flex-1 flex-col items-center gap-2"><div className="h-1 w-full rounded-full bg-sky-950/45" /><span className="text-xs text-muted-foreground">{day}</span></div>)}</div></div>;
}
