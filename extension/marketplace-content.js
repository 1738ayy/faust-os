(() => {
  const fieldSelectors = {
    title: ['input[name="title"]', 'input[aria-label*="title" i]', 'textarea[aria-label*="title" i]'],
    description: ['textarea[name="description"]', 'textarea[aria-label*="description" i]'],
    price: ['input[name="price"]', 'input[aria-label*="price" i]'],
    quantity: ['input[name="quantity"]', 'input[aria-label*="quantity" i]'],
    sku: ['input[name="sku"]', 'input[aria-label*="sku" i]'],
  };
  const setValue = (element, value) => {
    if (!element || value === undefined || value === null) return false;
    element.focus();
    element.value = String(value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  };
  function find(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }
    return null;
  }
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type !== "FAUST_FILL_MARKETPLACE_FORM") return;
    const mapping = message.mapping || {};
    const filled = Object.fromEntries(Object.entries(fieldSelectors).map(([key, selectors]) => [key, setValue(find(selectors), mapping[key])]));
    const blocked = Object.entries(filled).filter(([, ok]) => !ok).map(([key]) => key);
    sendResponse({ ok: true, filled, blocked, url: location.href, marketplace: location.hostname });
  });
})();
