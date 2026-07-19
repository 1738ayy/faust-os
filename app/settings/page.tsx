import { Settings2 } from "lucide-react";
import { AppLayout } from "@/components/navigation/app-layout";
import { DataCard, PageHeader, SecondaryButton } from "@/components/faust/design-system";
import { BusinessSettingsForm } from "@/components/settings/business-settings-form";
import { ExtensionConnections } from "@/components/settings/extension-connections";
import { getSettings } from "@/services/settings/repository";
import { getOperatingData } from "@/services/operating-system/repository";
export default async function SettingsPage() {
  const settings = await getSettings();
  const data = await getOperatingData();
  return <AppLayout><div className="max-w-5xl space-y-6">
    <PageHeader title="Settings" description="Manage business defaults, connected services, team access, and system health without exposing technical details in your daily workflow." />
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {["Connections", "Marketplace Accounts", "AI", "Shipping"].map((item) => <DataCard key={item} title={item}><p className="text-sm text-muted-foreground">Configuration lives here as services move from staging into live use.</p></DataCard>)}
    </section>
    <DataCard title="Business defaults" description="Core assumptions Faust uses for sourcing, pricing, inventory, and finance." icon={Settings2}>
      <BusinessSettingsForm settings={settings} />
    </DataCard>
    <DataCard title="System Health" description="Extension devices, service readiness, failed actions, and developer diagnostics are grouped here so they stay out of normal operating pages.">
      <div className="mb-5 flex flex-wrap gap-3">
        <SecondaryButton href="/settings">Connections</SecondaryButton>
        <SecondaryButton href="/settings">Developer Tools</SecondaryButton>
      </div>
      <ExtensionConnections data={data} />
    </DataCard>
  </div></AppLayout>;
}
