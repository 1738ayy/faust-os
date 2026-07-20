import { notFound } from "next/navigation";
import { AppLayout } from "@/components/navigation/app-layout";
import { EmptyState, PageHeader, StatusBadge } from "@/components/faust/design-system";
import { getMarketplace } from "@/lib/marketplaces";
import { getOpportunities } from "@/services/opportunities/local-opportunity-store";

const valid = ["depop", "mercari", "poshmark", "ebay", "etsy"] as const;

export default async function MarketplacePage({ params }: { params: Promise<{ marketplace: string }> }) {
  const { marketplace: id } = await params;
  if (!valid.includes(id as typeof valid[number])) notFound();
  const marketplace = getMarketplace(id as typeof valid[number]);
  const listings = (await getOpportunities()).filter((opportunity) => opportunity.listing.marketplaceId === id);

  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader eyebrow="Marketplace" title={marketplace.name} description={`Listings and opportunity drafts targeted for ${marketplace.name}.`} />
        {listings.length === 0 ? (
          <EmptyState title={`No ${marketplace.name} listings yet`} description={`Choose ${marketplace.name} while saving an opportunity to add it here.`} action={{ label: "Create opportunity", href: "/opportunity-analyzer" }} />
        ) : (
          <section className="faust-surface overflow-hidden">
            {listings.map((listing) => (
              <div key={listing.id} className="flex items-center justify-between gap-4 border-b border-sky-950/35 px-6 py-5 last:border-0">
                <div>
                  <p className="font-medium">{listing.product.name}</p>
                  <div className="mt-2"><StatusBadge value={listing.listing.status} /></div>
                </div>
                <p className="text-lg font-semibold tabular-nums">${listing.salePrice.toFixed(2)}</p>
              </div>
            ))}
          </section>
        )}
      </div>
    </AppLayout>
  );
}
