import { estimateMarketplaceFees } from "./marketplace-fee-profiles";
import type { OpportunityAnalysis } from "@/types/analysis";
import type { Opportunity } from "@/types/opportunity";

export function analyzeOpportunity(opportunity: Opportunity, options: { targetMargin?: number } = {}): OpportunityAnalysis {
  const revenue = opportunity.salePrice + opportunity.listing.shippingPrice;
  const feeResult = estimateMarketplaceFees(opportunity.listing.marketplaceId, { itemPrice: opportunity.salePrice, shippingPrice: opportunity.listing.shippingPrice }, opportunity.feeAssumptions);
  const editableCosts = Object.values(opportunity.costs)
    .filter((cost) => !cost.calculated)
    .reduce((total, cost) => total + cost.amount, 0);
  const totalCost = editableCosts + feeResult.totalSellingCosts;
  const grossProfit = revenue - editableCosts;
  const netProfit = revenue - totalCost;
  const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const roi = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;
  const markup = editableCosts > 0 ? (netProfit / editableCosts) * 100 : 0;
  const feeRate = feeResult.estimates.filter((estimate) => estimate.rate && estimate.enabled).reduce((sum, estimate) => sum + (estimate.rate || 0), 0);
  const breakEvenPrice = feeRate < 1 ? editableCosts / (1 - feeRate) : 0;
  const targetMargin = Math.max(0, Math.min(95, options.targetMargin ?? 50));
  const targetMarginDecimal = targetMargin / 100;
  const recommendedPrice = 1 - feeRate - targetMarginDecimal > 0 ? editableCosts / (1 - feeRate - targetMarginDecimal) : breakEvenPrice;

  return {
    revenue,
    totalCost,
    marketplaceFees: feeResult.marketplaceFees,
    paymentProcessingFees: feeResult.paymentProcessingFees,
    promotionFees: feeResult.promotionFees,
    totalSellingCosts: feeResult.totalSellingCosts,
    feeProfileVersion: feeResult.profile.version,
    feeEstimates: feeResult.estimates,
    feeProfileIncomplete: Boolean(feeResult.profile.incomplete),
    grossProfit,
    netProfit,
    margin,
    roi,
    markup,
    breakEvenPrice,
    recommendedPrice,
    targetMargin,
    capitalRequired: editableCosts,
  };
}
