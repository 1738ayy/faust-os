import { AppLayout } from "@/components/navigation/app-layout";
import { PageHeader } from "@/components/faust/design-system";
import { ActionCenterWorkspace } from "@/components/products/action-center-workspace";
import { buildProductExperiences } from "@/lib/product-experience";
import { buildProductPipeline } from "@/lib/product-pipeline";
import { getOperatingData, persistProductPipelineSnapshot } from "@/services/operating-system/repository";

export const dynamic = "force-dynamic";

export default async function ActionCenterPage() {
  const data = await getOperatingData();
  const products = buildProductExperiences(data);
  const pipeline = buildProductPipeline(data, products);
  await persistProductPipelineSnapshot(pipeline);

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Pipeline"
          title="Action Center"
          description="One operating inbox for Product review, draft readiness, publishing blockers, sync failures, and the next highest-value action."
          action={{ label: "Import products", href: "/sourcing" }}
        />
        <ActionCenterWorkspace pipeline={pipeline} />
      </div>
    </AppLayout>
  );
}
