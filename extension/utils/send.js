(() => {
  const endpoint = "http://localhost:3000/api/import-product";

  window.FaustSendProduct = async function sendProduct(product) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(product),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Faust could not import this product.");
    return result;
  };
})();
