import type { Product, Variant } from "@/domain/business";
import type { MarketplaceDraftInput } from "./types";

const time = "2026-07-23T00:00:00.000Z";
const product = (title: string, category: string, overrides: Partial<Product> = {}): Product => ({
  id: crypto.randomUUID(),
  title,
  brand: "Faust Supply",
  category,
  tags: [],
  image: `/${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`,
  images: [],
  description: `${title} sourced for Faust listing validation.`,
  status: "active",
  createdAt: time,
  updatedAt: time,
  ...overrides,
});
const variant = (productId: string, title = "Black / L", overrides: Partial<Variant> = {}): Variant => ({
  id: crypto.randomUUID(),
  productId,
  sku: `FST-${productId.slice(0, 4).toUpperCase()}-001`,
  title,
  condition: "Excellent",
  landedUnitCost: 12,
  defaultSalePrice: 42,
  weightOz: 14,
  reorderPoint: 2,
  reorderQuantity: 10,
  active: true,
  ...overrides,
});

export function marketplaceFixtureInputs(): { name: string; input: MarketplaceDraftInput }[] {
  const cases: [string, string, Partial<Product>?, Partial<Variant>?, string[]?][] = [
    ["T-shirt", "T-shirt", {}, { title: "Black / L" }, ["/tee-1.png", "/tee-2.png", "/tee-3.png"]],
    ["Hoodie", "Hoodie", {}, { title: "Grey / XL" }, ["/hoodie-1.png", "/hoodie-2.png", "/hoodie-3.png"]],
    ["Jeans", "Jeans", {}, { title: "Blue / 32" }, ["/jeans-1.png", "/jeans-2.png", "/jeans-3.png"]],
    ["Shoes", "Shoes", {}, { title: "Black / 10" }, ["/shoes-1.png", "/shoes-2.png", "/shoes-3.png"]],
    ["Necklace", "Necklace", {}, { title: "Silver / One Size", weightOz: 2 }, ["/necklace-1.png", "/necklace-2.png", "/necklace-3.png"]],
    ["Bracelet", "Bracelet", {}, { title: "Gold / One Size", weightOz: 2 }, ["/bracelet-1.png", "/bracelet-2.png", "/bracelet-3.png"]],
    ["Handbag", "Handbag", {}, { title: "Black / One Size", weightOz: 22 }, ["/bag-1.png", "/bag-2.png", "/bag-3.png"]],
    ["Collectible", "Collectible", {}, { title: "One Size" }, ["/collectible-1.png", "/collectible-2.png"]],
    ["Product with variants", "T-shirt", {}, { title: "Red / M" }, ["/variant-1.png", "/variant-2.png", "/variant-3.png"]],
    ["Product without brand", "Hoodie", { brand: undefined }, { title: "Black / L" }, ["/no-brand-1.png", "/no-brand-2.png", "/no-brand-3.png"]],
    ["Product without size", "T-shirt", {}, { title: "Black", sku: "FST-NOSIZE-001" }, ["/nosize-1.png", "/nosize-2.png", "/nosize-3.png"]],
    ["Product with one image", "T-shirt", {}, { title: "Black / L" }, ["/one-image.png"]],
    ["Product with ten images", "Hoodie", {}, { title: "Black / L" }, Array.from({ length: 10 }, (_, index) => `/ten-${index}.png`)],
    ["Product with missing weight", "Shoes", {}, { title: "Black / 10", weightOz: undefined }, ["/missing-weight-1.png", "/missing-weight-2.png", "/missing-weight-3.png"]],
    ["Product with marketplace override", "Jeans", {}, { title: "Blue / 34" }, ["/override-1.png", "/override-2.png", "/override-3.png"]],
    ["Product with invalid condition", "T-shirt", {}, { title: "Black / L", condition: "Mystery" }, ["/invalid-condition-1.png", "/invalid-condition-2.png", "/invalid-condition-3.png"]],
    ["Product with unsupported category", "Unknown Thing", {}, { title: "One Size" }, ["/unsupported-1.png", "/unsupported-2.png"]],
  ];
  return cases.map(([name, category, productOverrides, variantOverrides, imageUrls]) => {
    const item = product(`${name} fixture`, category, productOverrides);
    const itemVariant = variant(item.id, variantOverrides?.title, variantOverrides);
    return { name, input: { product: item, variant: itemVariant, physicalSku: itemVariant.sku, quantity: 2, imageUrls, overrides: name.includes("override") ? { price: 49 } : undefined } };
  });
}

export function marketplaceFixtureCoverage() {
  const fixtures = marketplaceFixtureInputs();
  const marketplaces = 5;
  return { marketplaces, fixtures: fixtures.length, generationScenarios: marketplaces * fixtures.length, validationScenarios: marketplaces * fixtures.length, readinessScenarios: marketplaces * fixtures.length };
}
