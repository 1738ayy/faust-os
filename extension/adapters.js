const FAUST_MARKETPLACE_ADAPTERS = {
  Depop: {
    marketplace: "Depop", version: "depop-2026.07.phase2", listingUrl: "https://www.depop.com/products/create",
    urlPatterns: [/depop\.com\/products\/create/i, /depop\.com\/sell/i],
    login: { in: ["[data-testid='user-menu']", "a[href*='/sellinghub']", "button[aria-label*='profile' i]"], out: ["a[href*='login']", "button[aria-label*='log in' i]"] },
    fields: {
      title: { required: true, primary: ["input[name='title']", "input[aria-label*='title' i]"], fallback: ["textarea[aria-label*='title' i]"], labels: ["Title", "Listing title"] },
      description: { required: true, primary: ["textarea[name='description']", "textarea[aria-label*='description' i]"], fallback: [], labels: ["Description"] },
      category: { required: true, primary: ["select[name='category']", "button[aria-label*='category' i]"], fallback: [], labels: ["Category"] },
      condition: { required: true, primary: ["select[name='condition']", "button[aria-label*='condition' i]"], fallback: [], labels: ["Condition"] },
      price: { required: true, primary: ["input[name='price']", "input[aria-label*='price' i]"], fallback: [], labels: ["Price"] },
      quantity: { required: false, primary: ["input[name='quantity']", "input[aria-label*='quantity' i]"], fallback: [], labels: ["Quantity"] },
      sku: { required: false, primary: ["input[name='sku']", "input[aria-label*='sku' i]"], fallback: [], labels: ["SKU"] },
      shipping: { required: false, primary: ["select[name='shipping']", "button[aria-label*='shipping' i]"], fallback: [], labels: ["Shipping"] },
    },
    images: ["input[type='file'][accept*='image']", "input[type='file']"],
    confirmation: { selectors: ["[data-testid='listing-live']", "a[href*='/products/']"], idPatterns: [/\/products\/([^/?#]+)/i] },
    errors: { selectors: ["[role='alert']", ".error", "[data-testid*='error']"], retryable: [/try again/i, /network/i, /temporar/i], permanent: [/required/i, /invalid/i, /prohibited/i] },
    fingerprint: { selectors: ["form", "input", "textarea"], text: ["Sell", "Description", "Price"] },
    fallback: "Guided manual completion after supported fields are highlighted.",
  },
  eBay: {
    marketplace: "eBay", version: "ebay-2026.07.phase2", listingUrl: "https://www.ebay.com/sl/sell",
    urlPatterns: [/ebay\.com\/sl\/sell/i, /ebay\.com\/lstng/i],
    login: { in: ["#gh-ug", "a[href*='SignOut']", "[aria-label*='account' i]"], out: ["a[href*='signin']", "#gh-ug-flex a[href*='signin']"] },
    fields: { title: { required: true, primary: ["input[name='title']", "#editpane_title", "input[aria-label*='title' i]"], fallback: [], labels: ["Title"] }, description: { required: true, primary: ["textarea[name='description']"], fallback: ["iframe[title*='description' i]"], labels: ["Description"] }, category: { required: true, primary: ["input[name='category']", "button[aria-label*='category' i]"], fallback: [], labels: ["Category"] }, condition: { required: true, primary: ["select[name='condition']", "button[aria-label*='condition' i]"], fallback: [], labels: ["Condition"] }, price: { required: true, primary: ["input[name='price']", "input[aria-label*='price' i]"], fallback: [], labels: ["Price"] }, quantity: { required: false, primary: ["input[name='quantity']", "input[aria-label*='quantity' i]"], fallback: [], labels: ["Quantity"] }, sku: { required: false, primary: ["input[name='sku']", "input[aria-label*='custom label' i]"], fallback: [], labels: ["SKU", "Custom label"] }, shipping: { required: false, primary: ["select[name='shipping']", "input[aria-label*='shipping' i]"], fallback: [], labels: ["Shipping"] } },
    images: ["input[type='file'][accept*='image']", "input[type='file']"], confirmation: { selectors: ["a[href*='/itm/']", "[data-testid*='success']"], idPatterns: [/\/itm\/(?:[^/]+\/)?(\d+)/i] }, errors: { selectors: ["[role='alert']", ".error", ".error-message"], retryable: [/try again/i, /temporar/i, /unavailable/i], permanent: [/required/i, /invalid/i, /policy/i] }, fingerprint: { selectors: ["form", "#mainContent", "input"], text: ["List", "Title", "Price"] }, fallback: "Fill safe fields, stop before final submit, capture unsupported item specifics.",
  },
  Etsy: {
    marketplace: "Etsy", version: "etsy-2026.07.phase2", listingUrl: "https://www.etsy.com/your/shops/me/tools/listings/create",
    urlPatterns: [/etsy\.com\/your\/shops\/.*\/tools\/listings\/create/i, /etsy\.com\/listing\/create/i],
    login: { in: ["a[href*='/your/']", "button[aria-label*='account' i]"], out: ["a[href*='signin']", "button[aria-label*='sign in' i]"] },
    fields: { title: { required: true, primary: ["input[name='title']", "input[aria-label*='title' i]"], fallback: [], labels: ["Title"] }, description: { required: true, primary: ["textarea[name='description']", "textarea[aria-label*='description' i]"], fallback: [], labels: ["Description"] }, category: { required: true, primary: ["input[name='taxonomy']", "input[aria-label*='category' i]"], fallback: [], labels: ["Category"] }, condition: { required: true, primary: ["select[name='condition']", "button[aria-label*='condition' i]"], fallback: [], labels: ["Condition"] }, price: { required: true, primary: ["input[name='price']", "input[aria-label*='price' i]"], fallback: [], labels: ["Price"] }, quantity: { required: false, primary: ["input[name='quantity']", "input[aria-label*='quantity' i]"], fallback: [], labels: ["Quantity"] }, sku: { required: false, primary: ["input[name='sku']", "input[aria-label*='sku' i]"], fallback: [], labels: ["SKU"] }, shipping: { required: false, primary: ["select[name='shipping_profile']", "input[aria-label*='shipping' i]"], fallback: [], labels: ["Shipping"] } },
    images: ["input[type='file'][accept*='image']", "input[type='file']"], confirmation: { selectors: ["a[href*='/listing/']", "[data-test-id*='listing-success']"], idPatterns: [/\/listing\/(\d+)/i] }, errors: { selectors: ["[role='alert']", ".wt-text-red", "[data-test-id*='error']"], retryable: [/try again/i, /temporar/i], permanent: [/required/i, /invalid/i, /policy/i] }, fingerprint: { selectors: ["form", "input", "textarea"], text: ["Listing", "Photos", "Price"] }, fallback: "Use Etsy guided publish; human confirms production partner and item specifics.",
  },
  Mercari: {
    marketplace: "Mercari", version: "mercari-2026.07.phase2", listingUrl: "https://www.mercari.com/sell/",
    urlPatterns: [/mercari\.com\/sell/i],
    login: { in: ["a[href*='/mypage']", "button[aria-label*='profile' i]"], out: ["a[href*='login']", "button[aria-label*='log in' i]"] },
    fields: { title: { required: true, primary: ["input[name='name']", "input[aria-label*='title' i]"], fallback: [], labels: ["Title"] }, description: { required: true, primary: ["textarea[name='description']", "textarea[aria-label*='description' i]"], fallback: [], labels: ["Description"] }, category: { required: true, primary: ["button[aria-label*='category' i]", "input[name='category']"], fallback: [], labels: ["Category"] }, condition: { required: true, primary: ["button[aria-label*='condition' i]", "select[name='condition']"], fallback: [], labels: ["Condition"] }, price: { required: true, primary: ["input[name='price']", "input[aria-label*='price' i]"], fallback: [], labels: ["Price"] }, quantity: { required: false, primary: ["input[name='quantity']"], fallback: [], labels: ["Quantity"] }, sku: { required: false, primary: ["input[name='sku']", "input[aria-label*='sku' i]"], fallback: [], labels: ["SKU"] }, shipping: { required: false, primary: ["button[aria-label*='shipping' i]", "select[name='shipping']"], fallback: [], labels: ["Shipping"] } },
    images: ["input[type='file'][accept*='image']", "input[type='file']"], confirmation: { selectors: ["a[href*='/item/']", "[data-testid*='success']"], idPatterns: [/\/item\/(m\d+)/i] }, errors: { selectors: ["[role='alert']", ".error"], retryable: [/try again/i, /temporar/i], permanent: [/required/i, /invalid/i] }, fingerprint: { selectors: ["form", "input", "textarea"], text: ["Sell", "Price"] }, fallback: "Mercari quantity may require manual single-listing coordination; risk locks prevent oversell.",
  },
  Poshmark: {
    marketplace: "Poshmark", version: "poshmark-2026.07.phase2", listingUrl: "https://poshmark.com/create-listing",
    urlPatterns: [/poshmark\.com\/create-listing/i, /poshmark\.com\/listing\/create/i],
    login: { in: [".user-image", "a[href*='/closet/']", "button[aria-label*='profile' i]"], out: ["a[href*='login']", "button[aria-label*='log in' i]"] },
    fields: { title: { required: true, primary: ["input[name='title']", "input[placeholder*='title' i]"], fallback: [], labels: ["Title"] }, description: { required: true, primary: ["textarea[name='description']", "textarea[placeholder*='description' i]"], fallback: [], labels: ["Description"] }, category: { required: true, primary: ["select[name='category']", "button[aria-label*='category' i]"], fallback: [], labels: ["Category"] }, condition: { required: true, primary: ["select[name='condition']", "button[aria-label*='condition' i]"], fallback: [], labels: ["Condition"] }, price: { required: true, primary: ["input[name='price']", "input[placeholder*='price' i]"], fallback: [], labels: ["Price"] }, quantity: { required: false, primary: ["input[name='quantity']"], fallback: [], labels: ["Quantity"] }, sku: { required: false, primary: ["input[name='sku']", "input[aria-label*='sku' i]"], fallback: [], labels: ["SKU"] }, shipping: { required: false, primary: ["select[name='shipping']", "button[aria-label*='shipping' i]"], fallback: [], labels: ["Shipping"] } },
    images: ["input[type='file'][accept*='image']", "input[type='file']"], confirmation: { selectors: ["a[href*='/listing/']", ".listing__title"], idPatterns: [/\/listing\/[^-]+-(\w+)/i] }, errors: { selectors: ["[role='alert']", ".error"], retryable: [/try again/i, /temporar/i], permanent: [/required/i, /invalid/i] }, fingerprint: { selectors: ["form", "input", "textarea"], text: ["Sell", "Listing", "Price"] }, fallback: "Fill closet draft fields, stop before final list button, require human confirmation.",
  },
};

function faustAdapterForHost(hostname = location.hostname) {
  const host = hostname.toLowerCase();
  if (host.includes("depop")) return FAUST_MARKETPLACE_ADAPTERS.Depop;
  if (host.includes("ebay")) return FAUST_MARKETPLACE_ADAPTERS.eBay;
  if (host.includes("etsy")) return FAUST_MARKETPLACE_ADAPTERS.Etsy;
  if (host.includes("mercari")) return FAUST_MARKETPLACE_ADAPTERS.Mercari;
  if (host.includes("poshmark")) return FAUST_MARKETPLACE_ADAPTERS.Poshmark;
  return null;
}

globalThis.FAUST_MARKETPLACE_ADAPTERS = FAUST_MARKETPLACE_ADAPTERS;
globalThis.faustAdapterForHost = faustAdapterForHost;
