import type { Costs } from "./cost";
import type { MarketplaceListing } from "./marketplace";
import type { FeeAssumptions } from "../lib/marketplace-fee-profiles";
import type { Product } from "./product";

export type Opportunity = {
  id: string;
  importQueueItemId?: string;
  product: Product;
  costs: Costs;
  listing: MarketplaceListing;
  feeAssumptions?: FeeAssumptions;
  salePrice: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
};
