import { BrainCircuit } from "lucide-react";
import { AppLayout } from "@/components/navigation/app-layout";
import { DataCard, PageHeader } from "@/components/faust/design-system";
import { ProductKnowledgeMemoryControls } from "@/components/settings/product-knowledge-memory";
import { getOperatingData } from "@/services/operating-system/repository";
import { productKnowledgeConfidenceRules } from "@/lib/product-knowledge";

export default async function ProductKnowledgeSettingsPage() {
  const data = await getOperatingData();
  const memories = [...(data.productKnowledgeMemory || [])].sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  const reviewFields = (data.productKnowledgeFields || []).filter((field) => field.reviewRequired || field.status === "rejected");

  return (
    <AppLayout>
      <div className="max-w-6xl space-y-6">
        <PageHeader
          eyebrow="Developer tools"
          title="Product Knowledge Memory"
          description="Inspect what Faust has learned from supplier evidence and user corrections. Memory can be suspended, restored, or deleted so learning stays explainable."
        />

        <section className="grid gap-4 md:grid-cols-3">
          <DataCard title="Memory rules"><p className="text-3xl font-semibold">{memories.length}</p></DataCard>
          <DataCard title="Active rules"><p className="text-3xl font-semibold">{memories.filter((memory) => memory.status !== "suspended").length}</p></DataCard>
          <DataCard title="Needs review"><p className="text-3xl font-semibold">{reviewFields.length}</p></DataCard>
        </section>

        <DataCard title="Learning policy" description="Faust uses the narrowest applicable rule and never turns a Product-specific edit into global truth automatically." icon={BrainCircuit}>
          <ul className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
            {productKnowledgeConfidenceRules.map((rule) => <li key={rule}>• {rule}</li>)}
          </ul>
        </DataCard>

        <DataCard title="Memory rules" description="Rules created from safe corrections. Suspend a rule if it starts teaching Faust the wrong lesson.">
          <ProductKnowledgeMemoryControls memories={memories} />
        </DataCard>
      </div>
    </AppLayout>
  );
}
