import { AppLayout } from "@/components/navigation/app-layout";
import { OpportunityProvider } from "@/components/opportunity/opportunity-provider";
import { OpportunityWorkspace } from "@/components/opportunity/opportunity-workspace";

export default function OpportunityAnalyzerPage() {
  return <AppLayout><OpportunityProvider><OpportunityWorkspace /></OpportunityProvider></AppLayout>;
}
