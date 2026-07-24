import { Network } from "lucide-react";
import { AppLayout } from "@/components/navigation/app-layout";
import { DataCard, DataTable, MarketplaceBadge, PageHeader, StatusBadge, TableCell } from "@/components/faust/design-system";
import { buildMarketplaceKnowledgeGraph, inspectMarketplaceDraft, listMarketplaceProfiles, marketplaceRegistrySummary } from "@/lib/marketplace-intelligence";
import { getOperatingData } from "@/services/operating-system/repository";

export default async function MarketplaceRegistryPage() {
  const data = await getOperatingData();
  const profiles = listMarketplaceProfiles();
  const summary = marketplaceRegistrySummary(data);
  const graph = buildMarketplaceKnowledgeGraph();
  const sampleVariant = data.variants.find((variant) => variant.active);
  const sampleProduct = sampleVariant ? data.products.find((product) => product.id === sampleVariant.productId) : undefined;
  const sampleInspector = sampleProduct && sampleVariant
    ? inspectMarketplaceDraft({ product: sampleProduct, variant: sampleVariant, physicalSku: sampleVariant.sku, quantity: 1, imageUrls: [sampleProduct.image, ...(sampleProduct.images || [])].filter((url): url is string => Boolean(url)) }, "Depop")
    : undefined;

  return (
    <AppLayout>
      <div className="max-w-7xl space-y-6">
        <PageHeader
          eyebrow="Developer tools"
          title="Marketplace Registry"
          description="Versioned marketplace knowledge for draft generation, validation, optimization, publishing, and synchronization."
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {summary.map((marketplace) => (
            <DataCard key={marketplace.marketplace} title={marketplace.marketplace}>
              <div className="space-y-3 text-sm text-muted-foreground">
                <StatusBadge value={marketplace.status} tone="success" />
                <p>Version {marketplace.version}</p>
                <p>{marketplace.requiredFields} required fields · {marketplace.syncFields} sync capabilities</p>
                <p>{marketplace.openReviews} open listing review(s)</p>
              </div>
            </DataCard>
          ))}
        </section>

        <DataCard title="Marketplace Knowledge Graph" description="Universal Faust product fields mapped to marketplace-specific translations, validations, capabilities, and ignored behavior." icon={Network}>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="faust-card p-4">
              <p className="text-sm text-muted-foreground">Schema version</p>
              <p className="mt-2 text-xl font-semibold">{graph.universalSchemaVersion}</p>
            </div>
            <div className="faust-card p-4">
              <p className="text-sm text-muted-foreground">Knowledge nodes</p>
              <p className="mt-2 text-xl font-semibold">{graph.nodes.length}</p>
            </div>
            <div className="faust-card p-4">
              <p className="text-sm text-muted-foreground">Marketplace relationships</p>
              <p className="mt-2 text-xl font-semibold">{graph.edges.length}</p>
            </div>
          </div>
        </DataCard>

        <DataCard title="Profile configuration" description="The Listings module consumes these rules instead of carrying marketplace conditionals.">
          <div className="space-y-6">
            {profiles.map((profile) => (
              <section className="faust-card p-5" key={profile.marketplace}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <MarketplaceBadge marketplace={profile.displayName} />
                      <StatusBadge value={profile.capabilities.publishing} tone="info" />
                    </div>
                    <h2 className="mt-3 text-2xl font-semibold">{profile.displayName} intelligence profile</h2>
                    <p className="mt-2 text-sm text-muted-foreground">Version {profile.profileVersion} · Effective {profile.effectiveAt.slice(0, 10)}</p>
                  </div>
                  <StatusBadge value={profile.capabilities.credentialState} tone={profile.capabilities.credentialState === "live_ready" ? "success" : "warning"} />
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-3">
                  <div className="rounded-3xl border border-slate-700/45 bg-black/25 p-4">
                    <h3 className="font-semibold">Requirements</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{profile.requirements.required.join(", ")}</p>
                  </div>
                  <div className="rounded-3xl border border-slate-700/45 bg-black/25 p-4">
                    <h3 className="font-semibold">Image rules</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{profile.imageRules.minImages}–{profile.imageRules.maxImages} images · {profile.imageRules.preferredAspectRatio} preferred · {profile.imageRules.minWidth}px minimum</p>
                  </div>
                  <div className="rounded-3xl border border-slate-700/45 bg-black/25 p-4">
                    <h3 className="font-semibold">Risk signals</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{profile.riskRules.warnings.join(", ")}</p>
                  </div>
                </div>

                <div className="mt-5">
                  <DataTable headers={["Universal field", "Marketplace field", "State", "Default"]} minWidth={640}>
                    {profile.fieldDefinitions.map((field) => (
                      <tr key={`${profile.marketplace}-${field.key}`}>
                        <TableCell primary={field.key} secondary={field.label} />
                        <TableCell primary={profile.mappings.fields[field.key]} />
                        <td className="px-5 py-3"><StatusBadge value={field.importance} tone={field.required ? "warning" : "neutral"} /></td>
                        <TableCell primary={field.supportsDefault ? "Supported" : "—"} />
                      </tr>
                    ))}
                  </DataTable>
                </div>
              </section>
            ))}
          </div>
        </DataCard>
        {sampleInspector && (
          <DataCard title="Marketplace Draft Inspector" description="Internal diagnostic view showing universal input, generated output, provenance, validation, readiness, and connector payload preview before publishing.">
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="faust-card p-4">
                <h2 className="font-semibold">Universal input</h2>
                <p className="mt-2 text-sm text-muted-foreground">{sampleInspector.universalInput.identity.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">Category: {sampleInspector.universalInput.identity.categoryId || "Missing"}</p>
                <p className="mt-1 text-sm text-muted-foreground">Images: {sampleInspector.universalInput.media.imageUrls.length}</p>
              </div>
              <div className="faust-card p-4">
                <h2 className="font-semibold">Readiness</h2>
                <p className="mt-2 text-2xl font-semibold">{sampleInspector.readinessResult.score}%</p>
                <StatusBadge value={sampleInspector.readinessResult.state} tone={sampleInspector.readinessResult.blockingIssues.length ? "warning" : "success"} />
              </div>
              <div className="faust-card p-4">
                <h2 className="font-semibold">Connector preview</h2>
                <p className="mt-2 text-sm text-muted-foreground">{String(sampleInspector.connectorPayloadPreview.title)}</p>
                <p className="mt-1 text-sm text-muted-foreground">{String(sampleInspector.connectorPayloadPreview.category || "No category")}</p>
              </div>
            </div>
            <div className="mt-5">
              <DataTable headers={["Field", "Value", "Source", "Confidence"]} minWidth={720}>
                {sampleInspector.mappingSources.map((field) => (
                  <tr key={field.fieldKey}>
                    <TableCell primary={field.fieldKey} />
                    <TableCell primary={Array.isArray(field.value) ? `${field.value.length} item(s)` : String(field.value || "—")} />
                    <TableCell primary={field.source} secondary={field.sourcePath || undefined} />
                    <TableCell primary={field.confidence === null ? "—" : `${Math.round(field.confidence * 100)}%`} />
                  </tr>
                ))}
              </DataTable>
            </div>
          </DataCard>
        )}
      </div>
    </AppLayout>
  );
}
