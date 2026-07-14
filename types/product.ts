import type { SuperbuyProduct, SuperbuyVariant } from "./superbuy-product";

export type Product = {
  id: string;
  name: string;
  category?: string;
  subcategory?: string;
  description?: string;
  material?: string;
  dimensions?: string;
  weight?: string;
  shippingWeight?: string;
  packageSize?: string;
  packageInfo?: string;
  supplier: Supplier;
  sourcing: ProductSourcing;
  media: ProductMedia;
  variants: SuperbuyVariant[];
  source: SuperbuyProduct;
};

export type Supplier = {
  name?: string;
  storeName?: string;
  storeUrl?: string;
  factoryName?: string;
};

export type ProductSourcing = {
  superbuyUrl: string;
  original1688Url?: string;
  sourcePrice?: number;
  sourcePriceRange?: { min: number; max: number };
  stock?: number;
  minimumOrderQuantity?: number;
};

export type ProductMedia = {
  images: string[];
};
