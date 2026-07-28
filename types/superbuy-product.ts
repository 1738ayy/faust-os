/** Facts captured from a Superbuy product page. Financial assumptions do not belong here. */
export type SuperbuyProduct = {
  source: "superbuy" | "1688";
  importedAt: string;
  title: string;
  superbuyUrl: string;
  original1688Url?: string;
  supplier?: string;
  supplierStoreUrl?: string;
  factoryName?: string;
  storeName?: string;
  category?: string;
  subcategory?: string;
  description?: string;
  material?: string;
  rawAttributes?: Record<string, string | number | boolean | string[]>;
  dimensions?: string;
  weight?: string;
  shippingWeight?: string;
  packageSize?: string;
  packageInfo?: string;
  stock?: number;
  minimumOrderQuantity?: number;
  price?: number;
  priceCurrency?: "RMB" | "USD" | "CNY";
  priceTiers?: { minimumQuantity: number; price: number; currency?: "RMB" | "USD" | "CNY" }[];
  domesticShipping?: number;
  domesticShippingCurrency?: "RMB" | "USD" | "CNY";
  internationalShipping?: number;
  dimensionsParsed?: { lengthCm?: number; widthCm?: number; heightCm?: number };
  sellerRating?: number;
  salesCount?: number;
  orderCount?: number;
  notes?: string;
  pageTimestamp?: string;
  priceRange?: { min: number; max: number };
  images: string[];
  variantOptions?: { colors?: string[]; sizes?: string[]; groups?: SuperbuyVariantGroup[]; combinations?: SuperbuyVariantCombination[] };
  variants: SuperbuyVariant[];
  storeStats?: StoreStats;
};

export type SuperbuyVariantGroup = {
  label: string;
  translatedLabel?: string;
  options: { id?: string; label: string; translatedLabel?: string; image?: string; price?: number; stock?: number; available?: boolean }[];
};

export type SuperbuyVariantCombination = {
  optionIds: string[];
  labels: string[];
  price?: number;
  stock?: number;
  available?: boolean;
};

export type SuperbuyVariant = {
  id: string;
  name: string;
  options: string[];
  image?: string;
  price?: number;
  stock?: number;
};

export type StoreStats = {
  salesCount?: number;
  favoritesCount?: number;
  reviewCount?: number;
};
