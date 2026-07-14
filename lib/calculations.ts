export function calculateLandedCost(
  productCost: number,
  overseasShipping: number,
  domesticShipping: number,
  packaging: number,
  marketplaceFee: number,
  miscellaneous: number
) {
  return (
    productCost +
    overseasShipping +
    domesticShipping +
    packaging +
    marketplaceFee +
    miscellaneous
  );
}

export function calculateProfit(
  salePrice: number,
  landedCost: number
) {
  return salePrice - landedCost;
}

export function calculateMargin(
  salePrice: number,
  profit: number
) {
  if (salePrice <= 0) return 0;

  return (profit / salePrice) * 100;
}

export function calculateROI(
  landedCost: number,
  profit: number
) {
  if (landedCost <= 0) return 0;

  return (profit / landedCost) * 100;
}