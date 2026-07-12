export function RevenueChart() {
  const data = [
    { day: "Mon", value: 45 },
    { day: "Tue", value: 62 },
    { day: "Wed", value: 38 },
    { day: "Thu", value: 80 },
    { day: "Fri", value: 95 },
    { day: "Sat", value: 72 },
    { day: "Sun", value: 110 },
  ];

  const max = Math.max(...data.map((d) => d.value));

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Revenue Analytics</h2>
          <p className="text-sm text-zinc-500">Last 7 Days</p>
        </div>

        <div className="text-right">
          <p className="text-2xl font-bold">$502</p>
          <p className="text-sm text-green-400">+18% this week</p>
        </div>
      </div>

      <div className="mt-8 flex h-48 items-end justify-between gap-3">
        {data.map((item) => (
          <div
            key={item.day}
            className="flex flex-1 flex-col items-center gap-2"
          >
            <div
              className="w-full rounded-t-lg bg-purple-500 transition-all hover:bg-purple-400"
              style={{
                height: `${(item.value / max) * 100}%`,
              }}
            />

            <span className="text-xs text-zinc-500">
              {item.day}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}