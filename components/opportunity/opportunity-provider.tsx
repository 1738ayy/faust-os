"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { analyzeOpportunity } from "@/lib/analyze-opportunity";
import { buildOpportunity } from "@/lib/builder/opportunity";
import type { OpportunityAnalysis } from "@/types/analysis";
import type { CostKey } from "@/types/cost";
import type { MarketplaceId } from "@/types/marketplace";
import type { Opportunity } from "@/types/opportunity";
import type { SuperbuyProduct } from "@/types/superbuy-product";

type OpportunityContextType = {
  opportunity: Opportunity | null;
  analysis: OpportunityAnalysis | null;
  importSuperbuyProduct: (product: SuperbuyProduct) => void;
  updateProduct: (field: "name" | "category" | "description" | "material" | "dimensions" | "weight" | "packageInfo", value: string) => void;
  updateCost: (key: CostKey, amount: number) => void;
  updateCostNotes: (key: CostKey, notes: string) => void;
  updateSalePrice: (amount: number) => void;
  updateMarketplace: (marketplaceId: MarketplaceId) => void;
  updateNotes: (notes: string) => void;
  resetOpportunity: () => void;
};

const OpportunityContext = createContext<OpportunityContextType | null>(null);

function touch(opportunity: Opportunity): Opportunity {
  return { ...opportunity, updatedAt: new Date().toISOString() };
}

export function OpportunityProvider({ children }: { children: ReactNode }) {
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const analysis = useMemo(() => (opportunity ? analyzeOpportunity(opportunity) : null), [opportunity]);

  function importSuperbuyProduct(product: SuperbuyProduct) {
    setOpportunity(buildOpportunity(product));
  }

  function updateProduct(field: "name" | "category" | "description" | "material" | "dimensions" | "weight" | "packageInfo", value: string) {
    setOpportunity((current) => current ? touch({
      ...current,
      product: { ...current.product, [field]: value },
      listing: field === "name" ? { ...current.listing, title: value } : current.listing,
    }) : current);
  }

  function updateCost(key: CostKey, amount: number) {
    setOpportunity((current) => current ? touch({
      ...current,
      costs: { ...current.costs, [key]: { ...current.costs[key], amount } },
    }) : current);
  }

  function updateCostNotes(key: CostKey, notes: string) {
    setOpportunity((current) => current ? touch({
      ...current,
      costs: { ...current.costs, [key]: { ...current.costs[key], notes } },
    }) : current);
  }

  function updateSalePrice(amount: number) {
    setOpportunity((current) => current ? touch({ ...current, salePrice: amount }) : current);
  }

  function updateMarketplace(marketplaceId: MarketplaceId) {
    setOpportunity((current) => current ? touch({
      ...current,
      listing: { ...current.listing, marketplaceId },
    }) : current);
  }

  function updateNotes(notes: string) {
    setOpportunity((current) => current ? touch({ ...current, notes }) : current);
  }

  return (
    <OpportunityContext.Provider value={{
      opportunity,
      analysis,
      importSuperbuyProduct,
      updateProduct,
      updateCost,
      updateCostNotes,
      updateSalePrice,
      updateMarketplace,
      updateNotes,
      resetOpportunity: () => setOpportunity(null),
    }}>
      {children}
    </OpportunityContext.Provider>
  );
}

export function useOpportunity() {
  const context = useContext(OpportunityContext);
  if (!context) throw new Error("useOpportunity must be used within OpportunityProvider.");
  return context;
}
