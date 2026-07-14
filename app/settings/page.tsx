import { Settings2 } from "lucide-react";
import { AppLayout } from "@/components/navigation/app-layout";
import { BusinessSettingsForm } from "@/components/settings/business-settings-form";
import { getSettings } from "@/services/settings/repository";
export default async function SettingsPage() { const settings = await getSettings(); return <AppLayout><div className="max-w-3xl space-y-6"><div><h1 className="text-3xl font-bold">Settings</h1><p className="mt-2 text-muted-foreground">Business defaults used by your local Faust OS workspace.</p></div><div className="rounded-xl border border-border bg-card p-6"><div className="flex items-center gap-3"><Settings2 className="h-6 w-6 text-violet-400" /><div><h2 className="text-lg font-semibold">Business defaults</h2><p className="text-sm text-muted-foreground">These are ready to move into Supabase later.</p></div></div><BusinessSettingsForm settings={settings} /></div></div></AppLayout>; }
