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
  const routes = [["/", "Set up Mission Control"], ["/inventory", "Inventory"], ["/orders", "Orders"], ["/purchasing", "Purchasing"], ["/shipping", "Shipping"], ["/listings", "Listings"], ["/finance", "Finance"], ["/analytics", "Analytics"], ["/automations", "Automations"], ["/ai-center", "AI Center"]] as const;
  for (const [route, title] of routes) {
    const appMain = page.getByTestId("app-main");
    await page.goto(route); await expect(appMain).toBeVisible(); await expect(appMain.getByRole("heading", { name: title, exact: true })).toBeVisible();
  }
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
