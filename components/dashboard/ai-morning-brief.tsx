import { BrainCircuit, Package, TrendingUp, Truck } from "lucide-react";

const items = [
  { icon: TrendingUp, text: "AI insights will appear once sales and listings are connected." },
  { icon: Package, text: "Import products from Superbuy to begin building your catalog." },
  { icon: Truck, text: "Connect shipping and warehouse services when you are ready." },
];

export function AiMorningBrief() {
  return <div className="faust-surface p-6"><div className="flex items-center gap-3"><BrainCircuit className="h-6 w-6 text-sky-200" /><div><h2 className="text-lg font-semibold">AI Morning Brief</h2><p className="text-sm text-muted-foreground">Daily business summary</p></div></div><div className="mt-6 rounded-2xl border border-sky-950/35 bg-black/35 p-4"><p className="font-medium">Welcome to Faust OS</p><p className="mt-2 text-sm text-muted-foreground">Your dashboard will become more useful as you import opportunities and connect your business data.</p></div><div className="mt-6 space-y-4">{items.map(({ icon: Icon, text }) => <div key={text} className="flex items-center gap-3"><Icon className="h-5 w-5 text-sky-200" /><p className="text-sm">{text}</p></div>)}</div></div>;
}
