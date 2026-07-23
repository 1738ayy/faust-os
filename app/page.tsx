import { AppLayout } from "@/components/navigation/app-layout";
import { MissionControl } from "@/components/operations/mission-control";
import { getCurrentUser } from "@/lib/auth";
import { isProductionAuthEnabled } from "@/lib/env";
import { getBusinessRepository } from "@/services/business/repository";
import { getOperatingData, snapshot } from "@/services/operating-system/repository";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";

export default async function Home() {
  if (isProductionAuthEnabled()) {
    const user = await getCurrentUser();
    const businesses = await getBusinessRepository().listForUser(user.id);
    if (!businesses.length) redirect("/onboarding");
  }

  return <AppLayout><MissionControl snapshot={snapshot(await getOperatingData())} /></AppLayout>;
}
