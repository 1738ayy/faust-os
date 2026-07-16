import type { Marketplace } from "../domain/business";

export type FillStrategy = "css" | "label" | "text" | "manual";
export type AdapterSelector = { field: string; primary: string[]; fallback: string[]; labels: string[]; required: boolean; strategy: FillStrategy };
export type ExtensionMarketplaceAdapter = {
  marketplace: Exclude<Marketplace, "Manual">;
  version: string;
  supportedUrlPatterns: string[];
  listingUrl: string;
  login: { loggedInSelectors: string[]; loggedOutSelectors: string[]; accountTextHints: string[] };
  fields: AdapterSelector[];
  categoryMap: Record<string, string>;
  conditionMap: Record<string, string>;
  shippingMap: Record<string, string>;
  quantity: { supported: boolean; selector: AdapterSelector; soldOutValue: string };
  images: { supported: boolean; inputSelectors: string[]; fallback: "manual_upload" | "drag_drop" };
  publishConfirmation: { successSelectors: string[]; idPatterns: string[]; urlPatterns: string[] };
  errors: { selectors: string[]; retryableText: string[]; permanentText: string[] };
  pageVersion: { fingerprintSelectors: string[]; expectedText: string[] };
  fallbackStrategy: string;
};

const title = (primary: string[], fallback: string[] = []): AdapterSelector => ({ field: "title", primary, fallback, labels: ["Title", "Listing title", "Product title"], required: true, strategy: "css" });
const description = (primary: string[], fallback: string[] = []): AdapterSelector => ({ field: "description", primary, fallback, labels: ["Description", "Describe your item"], required: true, strategy: "css" });
const price = (primary: string[], fallback: string[] = []): AdapterSelector => ({ field: "price", primary, fallback, labels: ["Price", "Listing price"], required: true, strategy: "css" });
const quantity = (primary: string[], fallback: string[] = []): AdapterSelector => ({ field: "quantity", primary, fallback, labels: ["Quantity", "Available quantity"], required: false, strategy: "css" });
const sku = (primary: string[], fallback: string[] = []): AdapterSelector => ({ field: "sku", primary, fallback, labels: ["SKU", "Custom label", "Seller SKU"], required: false, strategy: "css" });
const category = (primary: string[], fallback: string[] = []): AdapterSelector => ({ field: "category", primary, fallback, labels: ["Category"], required: true, strategy: "css" });
const condition = (primary: string[], fallback: string[] = []): AdapterSelector => ({ field: "condition", primary, fallback, labels: ["Condition"], required: true, strategy: "css" });
const shipping = (primary: string[], fallback: string[] = []): AdapterSelector => ({ field: "shipping", primary, fallback, labels: ["Shipping", "Delivery"], required: false, strategy: "css" });

const commonCategories = { hoodie: "Tops", shirt: "Tops", pants: "Bottoms", accessory: "Accessories", shoes: "Shoes" };
const commonConditions = { new: "New with tags", "new with tags": "New with tags", used: "Pre-owned", vintage: "Pre-owned" };
const commonShipping = { standard: "Standard", seller_paid: "Seller pays", buyer_paid: "Buyer pays" };

export const marketplaceAdapters: Record<Exclude<Marketplace, "Manual">, ExtensionMarketplaceAdapter> = {
  Depop: {
    marketplace: "Depop", version: "depop-2026.07.phase2", supportedUrlPatterns: ["https://www.depop.com/products/create", "https://*.depop.com/sell*"], listingUrl: "https://www.depop.com/products/create",
    login: { loggedInSelectors: ["[data-testid='user-menu']", "a[href*='/sellinghub']", "button[aria-label*='profile' i]"], loggedOutSelectors: ["a[href*='login']", "button:has-text('Log in')"], accountTextHints: ["Sell", "Selling hub"] },
    fields: [title(["input[name='title']", "input[aria-label*='title' i]"]), description(["textarea[name='description']", "textarea[aria-label*='description' i]"]), category(["select[name='category']", "button[aria-label*='category' i]"]), condition(["select[name='condition']", "button[aria-label*='condition' i]"]), price(["input[name='price']", "input[aria-label*='price' i]"]), quantity(["input[name='quantity']", "input[aria-label*='quantity' i]"]), sku(["input[name='sku']", "input[aria-label*='sku' i]"]), shipping(["select[name='shipping']", "button[aria-label*='shipping' i]"])],
    categoryMap: commonCategories, conditionMap: commonConditions, shippingMap: commonShipping, quantity: { supported: true, selector: quantity(["input[name='quantity']", "input[aria-label*='quantity' i]"]), soldOutValue: "0" }, images: { supported: true, inputSelectors: ["input[type='file'][accept*='image']", "input[type='file']"], fallback: "manual_upload" },
    publishConfirmation: { successSelectors: ["[data-testid='listing-live']", "a[href*='/products/']"], idPatterns: ["/products/([^/?#]+)"], urlPatterns: ["https://www.depop.com/products/"] }, errors: { selectors: ["[role='alert']", ".error", "[data-testid*='error']"], retryableText: ["try again", "network", "temporarily"], permanentText: ["required", "invalid", "prohibited"] }, pageVersion: { fingerprintSelectors: ["form", "input", "textarea"], expectedText: ["Sell", "Description", "Price"] }, fallbackStrategy: "Guided manual completion after supported fields are highlighted."
  },
  eBay: {
    marketplace: "eBay", version: "ebay-2026.07.phase2", supportedUrlPatterns: ["https://www.ebay.com/sl/sell*", "https://www.ebay.com/lstng*"], listingUrl: "https://www.ebay.com/sl/sell",
    login: { loggedInSelectors: ["#gh-ug", "a[href*='SignOut']", "[aria-label*='account' i]"], loggedOutSelectors: ["a[href*='signin']", "#gh-ug-flex a[href*='signin']"], accountTextHints: ["Hi", "Summary"] },
    fields: [title(["input[name='title']", "#editpane_title", "input[aria-label*='title' i]"]), description(["textarea[name='description']", "iframe[title*='description' i]"]), category(["input[name='category']", "button[aria-label*='category' i]"]), condition(["select[name='condition']", "button[aria-label*='condition' i]"]), price(["input[name='price']", "input[aria-label*='price' i]"]), quantity(["input[name='quantity']", "input[aria-label*='quantity' i]"]), sku(["input[name='sku']", "input[aria-label*='custom label' i]"]), shipping(["select[name='shipping']", "input[aria-label*='shipping' i]"])],
    categoryMap: commonCategories, conditionMap: { ...commonConditions, "new with tags": "New with tags" }, shippingMap: commonShipping, quantity: { supported: true, selector: quantity(["input[name='quantity']", "input[aria-label*='quantity' i]"]), soldOutValue: "0" }, images: { supported: true, inputSelectors: ["input[type='file'][accept*='image']", "input[type='file']"], fallback: "manual_upload" },
    publishConfirmation: { successSelectors: ["a[href*='/itm/']", "[data-testid*='success']"], idPatterns: ["/itm/(?:[^/]+/)?(\\d+)"], urlPatterns: ["https://www.ebay.com/itm/"] }, errors: { selectors: ["[role='alert']", ".error", ".error-message"], retryableText: ["temporarily", "try again", "service unavailable"], permanentText: ["required", "invalid", "policy"] }, pageVersion: { fingerprintSelectors: ["form", "#mainContent", "input"], expectedText: ["List", "Title", "Price"] }, fallbackStrategy: "Fill safe fields, stop before final submit, capture unsupported item specifics."
  },
  Etsy: {
    marketplace: "Etsy", version: "etsy-2026.07.phase2", supportedUrlPatterns: ["https://www.etsy.com/your/shops/*/tools/listings/create*", "https://www.etsy.com/listing/create*"], listingUrl: "https://www.etsy.com/your/shops/me/tools/listings/create",
    login: { loggedInSelectors: ["a[href*='/your/']", "button[aria-label*='account' i]"], loggedOutSelectors: ["a[href*='signin']", "button:has-text('Sign in')"], accountTextHints: ["Shop Manager", "Listings"] },
    fields: [title(["input[name='title']", "input[aria-label*='title' i]"]), description(["textarea[name='description']", "textarea[aria-label*='description' i]"]), category(["input[name='taxonomy']", "input[aria-label*='category' i]"]), condition(["select[name='condition']", "button[aria-label*='condition' i]"]), price(["input[name='price']", "input[aria-label*='price' i]"]), quantity(["input[name='quantity']", "input[aria-label*='quantity' i]"]), sku(["input[name='sku']", "input[aria-label*='sku' i]"]), shipping(["select[name='shipping_profile']", "input[aria-label*='shipping' i]"])],
    categoryMap: commonCategories, conditionMap: commonConditions, shippingMap: commonShipping, quantity: { supported: true, selector: quantity(["input[name='quantity']", "input[aria-label*='quantity' i]"]), soldOutValue: "0" }, images: { supported: true, inputSelectors: ["input[type='file'][accept*='image']", "input[type='file']"], fallback: "manual_upload" },
    publishConfirmation: { successSelectors: ["a[href*='/listing/']", "[data-test-id*='listing-success']"], idPatterns: ["/listing/(\\d+)"], urlPatterns: ["https://www.etsy.com/listing/"] }, errors: { selectors: ["[role='alert']", ".wt-text-red", "[data-test-id*='error']"], retryableText: ["try again", "temporarily"], permanentText: ["required", "invalid", "policy"] }, pageVersion: { fingerprintSelectors: ["form", "input", "textarea"], expectedText: ["Listing", "Photos", "Price"] }, fallbackStrategy: "Use Etsy guided publish; human confirms production partner and item specifics."
  },
  Mercari: {
    marketplace: "Mercari", version: "mercari-2026.07.phase2", supportedUrlPatterns: ["https://www.mercari.com/sell*", "https://www.mercari.com/sell/item*"], listingUrl: "https://www.mercari.com/sell/",
    login: { loggedInSelectors: ["a[href*='/mypage']", "button[aria-label*='profile' i]"], loggedOutSelectors: ["a[href*='login']", "button:has-text('Log in')"], accountTextHints: ["Sell", "Profile"] },
    fields: [title(["input[name='name']", "input[aria-label*='title' i]"]), description(["textarea[name='description']", "textarea[aria-label*='description' i]"]), category(["button[aria-label*='category' i]", "input[name='category']"]), condition(["button[aria-label*='condition' i]", "select[name='condition']"]), price(["input[name='price']", "input[aria-label*='price' i]"]), quantity(["input[name='quantity']", "input[aria-label*='quantity' i]"]), sku(["input[name='sku']", "input[aria-label*='sku' i]"]), shipping(["button[aria-label*='shipping' i]", "select[name='shipping']"])],
    categoryMap: commonCategories, conditionMap: commonConditions, shippingMap: commonShipping, quantity: { supported: false, selector: quantity(["input[name='quantity']"]), soldOutValue: "0" }, images: { supported: true, inputSelectors: ["input[type='file'][accept*='image']", "input[type='file']"], fallback: "manual_upload" },
    publishConfirmation: { successSelectors: ["a[href*='/item/']", "[data-testid*='success']"], idPatterns: ["/item/(m\\d+)"], urlPatterns: ["https://www.mercari.com/us/item/"] }, errors: { selectors: ["[role='alert']", ".error"], retryableText: ["try again", "temporarily"], permanentText: ["required", "invalid"] }, pageVersion: { fingerprintSelectors: ["form", "input", "textarea"], expectedText: ["Sell", "What are you selling", "Price"] }, fallbackStrategy: "Mercari quantity may require manual single-listing coordination; risk locks prevent oversell."
  },
  Poshmark: {
    marketplace: "Poshmark", version: "poshmark-2026.07.phase2", supportedUrlPatterns: ["https://poshmark.com/create-listing*", "https://poshmark.com/listing/create*"], listingUrl: "https://poshmark.com/create-listing",
    login: { loggedInSelectors: [".user-image", "a[href*='/closet/']", "button[aria-label*='profile' i]"], loggedOutSelectors: ["a[href*='login']", "button:has-text('Log in')"], accountTextHints: ["Sell", "Closet"] },
    fields: [title(["input[name='title']", "input[placeholder*='title' i]"]), description(["textarea[name='description']", "textarea[placeholder*='description' i]"]), category(["select[name='category']", "button[aria-label*='category' i]"]), condition(["select[name='condition']", "button[aria-label*='condition' i]"]), price(["input[name='price']", "input[placeholder*='price' i]"]), quantity(["input[name='quantity']", "input[aria-label*='quantity' i]"]), sku(["input[name='sku']", "input[aria-label*='sku' i]"]), shipping(["select[name='shipping']", "button[aria-label*='shipping' i]"])],
    categoryMap: commonCategories, conditionMap: commonConditions, shippingMap: commonShipping, quantity: { supported: false, selector: quantity(["input[name='quantity']"]), soldOutValue: "0" }, images: { supported: true, inputSelectors: ["input[type='file'][accept*='image']", "input[type='file']"], fallback: "manual_upload" },
    publishConfirmation: { successSelectors: ["a[href*='/listing/']", ".listing__title"], idPatterns: ["/listing/[^-]+-(\\w+)"], urlPatterns: ["https://poshmark.com/listing/"] }, errors: { selectors: ["[role='alert']", ".error"], retryableText: ["try again", "temporarily"], permanentText: ["required", "invalid"] }, pageVersion: { fingerprintSelectors: ["form", "input", "textarea"], expectedText: ["Sell", "Listing", "Price"] }, fallbackStrategy: "Fill closet draft fields, stop before final list button, require human confirmation."
  },
};

export function adapterForMarketplace(marketplace: Exclude<Marketplace, "Manual">) {
  return marketplaceAdapters[marketplace];
}

export function adapterHealth(adapter: ExtensionMarketplaceAdapter) {
  const required = adapter.fields.filter((field) => field.required);
  const missingFallbacks = required.filter((field) => !field.primary.length || (!field.fallback.length && !field.labels.length));
  return { marketplace: adapter.marketplace, version: adapter.version, status: missingFallbacks.length ? "needs_attention" : "healthy", requiredFields: required.length, fallbackCoverage: required.length - missingFallbacks.length, missingFields: missingFallbacks.map((field) => field.field) };
}
