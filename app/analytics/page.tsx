import { AppLayout } from "@/components/navigation/app-layout";
import { AnalyticsDecisionEngine } from "@/components/operations/analytics-decision-engine";
import type { AnalyticsFilters } from "@/lib/analytics";
import { getOperatingData, snapshot } from "@/services/operating-system/repository";
export const dynamic = "force-dynamic";
export default async function AnalyticsPage({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const pick = (key: string) => {
    const value = params?.[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const filters: AnalyticsFilters = { from: pick("from"), to: pick("to"), marketplace: pick("marketplace"), supplierId: pick("supplierId"), sku: pick("sku") };
  return <AppLayout><AnalyticsDecisionEngine snapshot={snapshot(await getOperatingData())} filters={filters} /></AppLayout>;
}
