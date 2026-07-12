import { ReactNode } from "react";

type StatCardProps = {
  title: string;
  value: string;
  subtitle?: string;
  icon?: ReactNode;
};

export function StatCard({
  title,
  value,
  subtitle,
  icon,
}: StatCardProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 transition-all duration-200 hover:border-zinc-700 hover:shadow-lg">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-zinc-400">{title}</p>

          <h2 className="mt-2 text-3xl font-bold tracking-tight">
            {value}
          </h2>

          {subtitle && (
            <p className="mt-2 text-xs text-zinc-500">
              {subtitle}
            </p>
          )}
        </div>

        {icon && (
          <div className="rounded-lg border border-zinc-800 p-3">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}