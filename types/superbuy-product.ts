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
  dimensions?: string;
  weight?: string;
  shippingWeight?: string;
  packageSize?: string;
  packageInfo?: string;
  stock?: number;
  minimumOrderQuantity?: number;
  price?: number;
  domesticShipping?: number;
  internationalShipping?: number;
  dimensionsParsed?: { lengthCm?: number; widthCm?: number; heightCm?: number };
  sellerRating?: number;
  salesCount?: number;
  orderCount?: number;
  notes?: string;
  pageTimestamp?: string;
  priceRange?: { min: number; max: number };
  images: string[];
  variants: SuperbuyVariant[];
  storeStats?: StoreStats;
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
