import { expect, test, type APIRequestContext } from "@playwright/test";

async function resetDemo(request: APIRequestContext) {
  const response = await request.post("/api/operating-system", { data: { action: "reset", mode: "development_demo" } });
  expect(response.ok()).toBeTruthy(); const data = await response.json(); expect(data.data?.orders?.some((order: { number: string }) => order.number === "FO-1042")).toBeTruthy(); expect(data.data?.balances?.length).toBeGreaterThan(0);
}

test("authentication screens expose sign in, signup, and recovery", async ({ page }) => {
  await page.goto("/sign-in"); await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
  await page.getByRole("link", { name: /create account/i }).click(); await expect(page.getByRole("heading", { name: /create your workspace/i })).toBeVisible();
  await page.getByRole("link", { name: /reset password/i }).click(); await expect(page.getByRole("heading", { name: /reset your password/i })).toBeVisible();
});

test("primary operations pages render their operational page titles", async ({ page }) => {
  const routes = [
    ["/", "Set up Mission Control"],
    ["/inventory", "Stock, locations, and receiving"],
    ["/orders", "Orders"],
    ["/purchasing", "Purchasing & inbound"],
    ["/shipping", "Warehouse fulfillment center"],
    ["/listings", "Marketplace drafts, validation, and delist coordination"],
    ["/finance", "Ledger, payout reconciliation, cash, and planning"],
    ["/analytics", "Business trends and drill-down comparisons"],
    ["/automations", "Rule builder, run logs, retries, and failures"],
    ["/ai-center", "Daily brief and evidence-backed recommendations"],
  ] as const;
  for (const [route, title] of routes) {
    const appMain = page.getByTestId("app-main");
    await page.goto(route); await expect(appMain).toBeVisible(); await expect(appMain.getByRole("heading", { name: title, exact: true })).toBeVisible();
  }
});

test("fulfillment API persists pick, pack, label, dispatch, tracking, exception, finance, order, and inventory state", async ({ request }) => {
  await resetDemo(request);
  const beforeResponse = await request.get("/api/operating-system"); expect(beforeResponse.ok()).toBeTruthy(); const before = await beforeResponse.json();
  const order = before.data.orders.find((entry: { number: string }) => entry.number === "FO-1042");
  const pick = await request.post("/api/fulfillment/actions", { data: { action: "begin-picking", orderId: order.id, picker: "Playwright picker", mode: "single" } }); expect(pick.ok(), await pick.text()).toBeTruthy(); let state = (await pick.json()).data; let shipment = state.fulfillmentShipments.find((entry: { orderId: string }) => entry.orderId === order.id); expect(shipment.status).toBe("picking");
  const missing = await request.post("/api/fulfillment/actions", { data: { action: "complete-picking", shipmentId: shipment.id, outcomes: [{ itemId: state.fulfillmentPickLists[0].items[0].id, status: "missing", notes: "Missing during verification" }] } }); expect(missing.ok(), await missing.text()).toBeTruthy(); state = (await missing.json()).data; shipment = state.fulfillmentShipments.find((entry: { id: string }) => entry.id === shipment.id); expect(shipment.status).toBe("exception"); expect(state.notices.some((entry: { category?: string }) => entry.category === "shipping")).toBeTruthy();
  const exception = await request.post("/api/fulfillment/actions", { data: { action: "record-exception", shipmentId: shipment.id, type: "damaged_package", severity: "critical", owner: "QA", notes: "Damaged carton" } }); expect(exception.ok(), await exception.text()).toBeTruthy(); state = (await exception.json()).data; const exceptionRecord = state.fulfillmentExceptions[0]; expect(exceptionRecord.status).toBe("open");
  const resolved = await request.post("/api/fulfillment/actions", { data: { action: "resolve-exception", exceptionId: exceptionRecord.id, notes: "Repacked safely" } }); expect(resolved.ok(), await resolved.text()).toBeTruthy();
  await resetDemo(request);
  const fresh = await (await request.get("/api/operating-system")).json(); const freshOrder = fresh.data.orders.find((entry: { number: string }) => entry.number === "FO-1042"); const freshBalance = fresh.data.balances.find((entry: { variantId: string }) => entry.variantId === freshOrder.items[0].variantId);
  state = (await (await request.post("/api/fulfillment/actions", { data: { action: "begin-picking", orderId: freshOrder.id, picker: "Playwright picker", mode: "single" } })).json()).data; shipment = state.fulfillmentShipments.find((entry: { orderId: string }) => entry.orderId === freshOrder.id);
  state = (await (await request.post("/api/fulfillment/actions", { data: { action: "complete-picking", shipmentId: shipment.id } })).json()).data; shipment = state.fulfillmentShipments.find((entry: { id: string }) => entry.id === shipment.id); expect(shipment.status).toBe("ready_to_pack");
  state = (await (await request.post("/api/fulfillment/actions", { data: { action: "begin-packing", shipmentId: shipment.id, packer: "Pack QA", station: "Station 1" } })).json()).data; shipment = state.fulfillmentShipments.find((entry: { id: string }) => entry.id === shipment.id); expect(shipment.status).toBe("packing");
  state = (await (await request.post("/api/fulfillment/actions", { data: { action: "complete-packing", shipmentId: shipment.id, packageType: "poly_mailer", weightOz: 22, lengthIn: 14, widthIn: 10, heightIn: 2 } })).json()).data; shipment = state.fulfillmentShipments.find((entry: { id: string }) => entry.id === shipment.id); expect(shipment.packages.length).toBe(1); expect(shipment.scanLog.length).toBeGreaterThan(0);
  state = (await (await request.post("/api/fulfillment/actions", { data: { action: "validate-address", shipmentId: shipment.id, provider: "local_mock" } })).json()).data; shipment = state.fulfillmentShipments.find((entry: { id: string }) => entry.id === shipment.id); expect(shipment.addressValidation.status).toBe("valid");
  state = (await (await request.post("/api/fulfillment/actions", { data: { action: "get-rates", shipmentId: shipment.id, provider: "local_mock" } })).json()).data; shipment = state.fulfillmentShipments.find((entry: { id: string }) => entry.id === shipment.id); expect(shipment.rates.length).toBeGreaterThan(0);
  state = (await (await request.post("/api/fulfillment/actions", { data: { action: "select-rate", shipmentId: shipment.id, rateId: shipment.rates[0].id } })).json()).data; shipment = state.fulfillmentShipments.find((entry: { id: string }) => entry.id === shipment.id); expect(shipment.selectedRateId).toBeTruthy();
  state = (await (await request.post("/api/fulfillment/actions", { data: { action: "generate-label", shipmentId: shipment.id, carrier: shipment.carrier, service: shipment.service, postageCost: shipment.postageCost } })).json()).data; shipment = state.fulfillmentShipments.find((entry: { id: string }) => entry.id === shipment.id); expect(shipment.trackingNumber).toContain("MOCK-"); expect(shipment.labelHistory.length).toBeGreaterThan(0); expect(state.transactions.some((entry: { type: string; orderId: string }) => entry.type === "shipping" && entry.orderId === freshOrder.id)).toBeTruthy();
  state = (await (await request.post("/api/fulfillment/actions", { data: { action: "print-label", shipmentId: shipment.id, kind: "print" } })).json()).data; shipment = state.fulfillmentShipments.find((entry: { id: string }) => entry.id === shipment.id); expect(shipment.events.some((entry: { status: string }) => entry.status === "printed")).toBeTruthy();
  state = (await (await request.post("/api/fulfillment/actions", { data: { action: "void-label", shipmentId: shipment.id, reason: "Playwright label lifecycle" } })).json()).data; shipment = state.fulfillmentShipments.find((entry: { id: string }) => entry.id === shipment.id); expect(shipment.labelHistory.some((entry: { status: string }) => entry.status === "voided")).toBeTruthy();
  state = (await (await request.post("/api/fulfillment/actions", { data: { action: "regenerate-label", shipmentId: shipment.id } })).json()).data; shipment = state.fulfillmentShipments.find((entry: { id: string }) => entry.id === shipment.id); expect(shipment.labelHistory.some((entry: { status: string }) => entry.status === "regenerated")).toBeTruthy();
  state = (await (await request.post("/api/fulfillment/actions", { data: { action: "create-manifest", shipmentIds: [shipment.id], carrier: shipment.carrier } })).json()).data; shipment = state.fulfillmentShipments.find((entry: { id: string }) => entry.id === shipment.id); expect(shipment.status).toBe("manifested");
  state = (await (await request.post("/api/fulfillment/actions", { data: { action: "dispatch", shipmentId: shipment.id } })).json()).data; shipment = state.fulfillmentShipments.find((entry: { id: string }) => entry.id === shipment.id); const shippedOrder = state.orders.find((entry: { id: string }) => entry.id === freshOrder.id); const shippedBalance = state.balances.find((entry: { id: string }) => entry.id === freshBalance.id); expect(shipment.status).toBe("in_transit"); expect(shippedOrder.status).toBe("shipped"); expect(shippedBalance.onHand).toBe(freshBalance.onHand - 1);
  state = (await (await request.post("/api/fulfillment/actions", { data: { action: "refresh-tracking", shipmentId: shipment.id } })).json()).data; shipment = state.fulfillmentShipments.find((entry: { id: string }) => entry.id === shipment.id); expect(shipment.lastScan).toBeTruthy();
  state = (await (await request.post("/api/fulfillment/actions", { data: { action: "delivered", shipmentId: shipment.id } })).json()).data; expect(state.orders.find((entry: { id: string }) => entry.id === freshOrder.id).status).toBe("delivered");
  state = (await (await request.post("/api/fulfillment/actions", { data: { action: "returned", shipmentId: shipment.id, notes: "Customer returned package" } })).json()).data; expect(state.fulfillmentShipments.find((entry: { id: string }) => entry.id === shipment.id).status).toBe("returned");
});

test("fulfillment center browser flow drives real API actions", async ({ request, page }) => {
  await resetDemo(request);
  await page.goto("/shipping");
  await expect(page.getByRole("heading", { name: "Warehouse fulfillment center", exact: true })).toBeVisible();
  await expect(page.getByText("FO-1042")).toBeVisible();
  const startPickResponse = page.waitForResponse((response) => response.url().includes("/api/fulfillment/actions") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Start pick" }).click();
  expect((await startPickResponse).ok()).toBeTruthy();
  await expect(page.getByRole("status")).toContainText("Picking started.");
  await page.getByRole("button", { name: "Complete pick" }).click();
  await expect(page.getByRole("status")).toContainText("Picking completed.");
  await page.getByRole("button", { name: "Begin pack" }).click();
  await expect(page.getByRole("status")).toContainText("Packing started.");
  await page.getByRole("button", { name: "Complete pack" }).click();
  await expect(page.getByRole("status")).toContainText("Packing completed.");
  await page.getByRole("button", { name: "Validate address" }).click();
  await expect(page.getByRole("status")).toContainText("Address validated.");
  await page.getByRole("button", { name: "Get rates" }).click();
  await expect(page.getByRole("status")).toContainText("Rates loaded.");
  await page.getByRole("button", { name: "Select best rate" }).click();
  await expect(page.getByRole("status")).toContainText("Rate selected.");
  await page.getByRole("button", { name: "Generate mock label" }).click();
  await expect(page.getByRole("status")).toContainText("Label generated.");
  await page.getByRole("button", { name: "Print/reprint" }).click();
  await expect(page.getByRole("status")).toContainText("Label print recorded.");
  await page.getByRole("button", { name: "Void label" }).click();
  await expect(page.getByRole("status")).toContainText("Label voided.");
  await page.getByRole("button", { name: "Regenerate label" }).click();
  await expect(page.getByRole("status")).toContainText("Label regenerated.");
  await page.getByRole("button", { name: "Dispatch" }).click();
  await expect(page.getByRole("status")).toContainText("Shipment dispatched.");
  await expect(page.getByText(/Carrier accepted package/i)).toBeVisible();
  await page.getByRole("button", { name: "Refresh tracking" }).click();
  await expect(page.getByRole("status")).toContainText("Tracking refreshed.");
  const operating = await (await request.get("/api/operating-system")).json();
  const shipment = operating.data.fulfillmentShipments.find((entry: { orderId: string }) => entry.orderId === operating.data.orders.find((order: { number: string }) => order.number === "FO-1042").id);
  const exception = await request.post("/api/fulfillment/actions", { data: { action: "record-exception", shipmentId: shipment.id, type: "carrier_delay", severity: "warning", owner: "Playwright", notes: "Carrier delay browser verification" } });
  expect(exception.ok(), await exception.text()).toBeTruthy();
  await page.reload();
  await page.getByRole("button", { name: "Resolve" }).click();
  await expect(page.getByRole("status")).toContainText("Exception resolved.");
  await resetDemo(request);
  await page.goto("/shipping");
  await page.getByLabel("Select FO-1042").check();
  await page.getByRole("button", { name: "Batch pick" }).click();
  await expect(page.getByRole("status")).toContainText("Batch pick started");
});

test("local source-to-sale fixture can be loaded without external credentials", async ({ request, page }) => {
  await resetDemo(request);
  await page.goto("/orders"); await expect(page.getByRole("heading", { name: /FO-1042 · Depop/i })).toBeVisible();
  await page.goto("/purchasing"); await expect(page.getByText("DEMO-17TRACK-1042")).toBeVisible();
});

test("inventory adjustment API updates the demo balance with an audit trail", async ({ request }) => {
  await resetDemo(request); const before = await request.get("/api/operating-system"); expect(before.ok()).toBeTruthy(); const snapshot = await before.json(); const balance = snapshot.data.balances[0];
  const response = await request.post("/api/inventory/adjust", { data: { balanceId: balance.id, quantity: 1, reason: "Playwright direct API verification", idempotencyKey: crypto.randomUUID() } }); const body = await response.text(); expect(response.ok(), body).toBeTruthy(); const updated = JSON.parse(body).data;
  expect(updated.balances.find((entry: { id: string }) => entry.id === balance.id).onHand).toBe(balance.onHand + 1); expect(updated.stockMovements.some((entry: { referenceType?: string }) => entry.referenceType === "inventory_adjustment")).toBeTruthy(); expect(updated.activity.some((entry: { entityType: string }) => entry.entityType === "inventory_balance")).toBeTruthy();
});

test("inventory exposes audited mutation controls and refreshed balances", async ({ request, page }) => {
  await resetDemo(request);
  await page.goto("/inventory");
  const panel = page.getByRole("region", { name: "Inventory actions" });
  for (const label of ["Adjust stock", "Transfer", "Cycle count", "Mark damaged", "Move to quarantine", "Release quarantine", "Mark lost", "Record found", "Assign location"]) await expect(panel.getByRole("button", { name: label, exact: true })).toBeVisible();
  await panel.getByRole("button", { name: "Adjust stock", exact: true }).click();
  await panel.locator('input[name="quantity"]').fill("1"); await panel.locator('input[name="reason"]').fill("Browser inventory verification"); await panel.locator('input[name="confirm"]').check();
  const responsePromise = page.waitForResponse((response) => response.url().includes("/api/inventory/adjust") && response.request().method() === "POST");
  await panel.getByRole("button", { name: /confirm adjust stock/i }).click();
  const response = await responsePromise; const responseBody = await response.text(); expect(response.ok(), responseBody).toBeTruthy();
  await expect(panel.getByRole("status")).toContainText(/saved/i);
  await expect(page.getByText(/movement history/i).first()).toBeVisible();
  await panel.getByRole("button", { name: "Mark damaged", exact: true }).click();
  await expect(panel.getByText(/remove usable units/i)).toBeVisible();
  await panel.getByRole("button", { name: "Move to quarantine", exact: true }).click();
  await expect(panel.getByText(/hold units out of availability/i)).toBeVisible();
  await panel.getByRole("button", { name: "Release quarantine", exact: true }).click();
  await expect(panel.getByText(/return inspected units/i)).toBeVisible();
  await panel.getByRole("button", { name: "Mark lost", exact: true }).click();
  await expect(panel.getByText(/remove missing usable units/i)).toBeVisible();
  await panel.getByRole("button", { name: "Record found", exact: true }).click();
  await expect(panel.getByText(/add recovered units/i)).toBeVisible();
  await panel.getByRole("button", { name: "Assign location", exact: true }).click();
  await expect(panel.getByText(/assign currently unlocated stock/i)).toBeVisible();
});
