import { AppLayout } from "@/components/navigation/app-layout";
import { MissionControl } from "@/components/operations/mission-control";
import { getOperatingData, snapshot } from "@/services/operating-system/repository";
export const dynamic = "force-dynamic";

export default async function Home() {
  return <AppLayout><MissionControl snapshot={snapshot(await getOperatingData())} /></AppLayout>;
}
