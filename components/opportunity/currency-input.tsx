"use client";

type CurrencyInputProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
};

export function CurrencyInput({ label, value, onChange }: CurrencyInputProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <label className="font-medium">{label}</label>
      <div className="relative w-36">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={value || ""}
          onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
          className="w-full rounded-lg border border-red-950/45 bg-black/35 py-2 pl-7 pr-3 text-right outline-none transition focus:border-red-500/60"
        />
      </div>
    </div>
  );
}
