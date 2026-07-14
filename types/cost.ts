export type CostKey =
  | "product"
  | "domesticShipping"
  | "internationalShipping"
  | "packaging"
  | "marketplaceFees"
  | "paymentProcessing"
  | "advertising"
  | "taxes"
  | "storage"
  | "warehouse"
  | "returns"
  | "miscellaneous";

export type CostLine = {
  key: CostKey;
  label: string;
  amount: number;
  notes?: string;
  calculated?: boolean;
};

export type Costs = Record<CostKey, CostLine>;
