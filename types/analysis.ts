import type { FeeEstimate } from "../lib/marketplace-fee-profiles";

export type OpportunityAnalysis = {
  revenue: number;
  totalCost: number;
  marketplaceFees: number;
  paymentProcessingFees: number;
  promotionFees: number;
  totalSellingCosts: number;
  feeProfileVersion: string;
  feeEstimates: FeeEstimate[];
  feeProfileIncomplete: boolean;
  grossProfit: number;
  netProfit: number;
  margin: number;
  roi: number;
  markup: number;
  breakEvenPrice: number;
  recommendedPrice: number;
  targetMargin: number;
  capitalRequired: number;
};
