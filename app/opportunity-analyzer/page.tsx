import { AppLayout } from "@/components/navigation/app-layout";
import { OpportunityProvider } from "@/components/opportunity/opportunity-provider";
import { OpportunityWorkspace } from "@/components/opportunity/opportunity-workspace";
import { getSettings } from "@/services/settings/repository";

export default async function OpportunityAnalyzerPage() {
  const settings = await getSettings();
  return <AppLayout><OpportunityProvider settings={settings}><OpportunityWorkspace /></OpportunityProvider></AppLayout>;
}
