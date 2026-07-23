import { notFound } from "next/navigation";
import { AppLayout } from "@/components/navigation/app-layout";
import { ProductWorkspace } from "@/components/products/product-workspace";
import { buildProductExperienceByVariantId } from "@/lib/product-experience";
import { getOperatingData } from "@/services/operating-system/repository";

export const dynamic = "force-dynamic";

export default async function ProductWorkspacePage({ params }: { params: Promise<{ variantId: string }> }) {
  const { variantId } = await params;
  const data = await getOperatingData();
  const product = buildProductExperienceByVariantId(data, variantId);
  if (!product) notFound();
  return <AppLayout><ProductWorkspace item={product} /></AppLayout>;
}
