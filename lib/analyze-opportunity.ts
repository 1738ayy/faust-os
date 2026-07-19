import { getMarketplace } from "./marketplaces";
import type { OpportunityAnalysis } from "@/types/analysis";
import type { Opportunity } from "@/types/opportunity";

export function analyzeOpportunity(opportunity: Opportunity, options: { targetMargin?: number } = {}): OpportunityAnalysis {
  const marketplace = getMarketplace(opportunity.listing.marketplaceId);
  const revenue = opportunity.salePrice + opportunity.listing.shippingPrice;
  const marketplaceFees = revenue * marketplace.sellingFeeRate;
  const paymentProcessingFees = revenue * marketplace.paymentFeeRate;
  const editableCosts = Object.values(opportunity.costs)
    .filter((cost) => !cost.calculated)
    .reduce((total, cost) => total + cost.amount, 0);
  const totalCost = editableCosts + marketplaceFees + paymentProcessingFees;
  const grossProfit = revenue - editableCosts;
  const netProfit = revenue - totalCost;
  const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  const roi = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;
  const markup = editableCosts > 0 ? (netProfit / editableCosts) * 100 : 0;
  const feeRate = marketplace.sellingFeeRate + marketplace.paymentFeeRate;
  const breakEvenPrice = feeRate < 1 ? editableCosts / (1 - feeRate) : 0;
  const targetMargin = Math.max(0, Math.min(95, options.targetMargin ?? 50));
  const targetMarginDecimal = targetMargin / 100;
  const recommendedPrice = 1 - feeRate - targetMarginDecimal > 0 ? editableCosts / (1 - feeRate - targetMarginDecimal) : breakEvenPrice;

  return {
    revenue,
    totalCost,
    marketplaceFees,
    paymentProcessingFees,
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
