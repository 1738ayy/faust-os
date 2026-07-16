import { analyticsCsv, buildAnalyticsModel, type AnalyticsFilters } from "@/lib/analytics";
import { getOperatingData } from "@/services/operating-system/repository";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const filters: AnalyticsFilters = {
    from: url.searchParams.get("from") || undefined,
    to: url.searchParams.get("to") || undefined,
    marketplace: url.searchParams.get("marketplace") || undefined,
    supplierId: url.searchParams.get("supplierId") || undefined,
    sku: url.searchParams.get("sku") || undefined,
  };
  const csv = analyticsCsv(buildAnalyticsModel(await getOperatingData(), filters));
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="faust-analytics-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
