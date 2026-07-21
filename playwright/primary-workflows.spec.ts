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

test("primary operations pages render their operational page titles", async ({ request, page }) => {
  test.setTimeout(60_000);
  await resetDemo(request);
  const routes = [
    ["/", "Know what needs action next."],
    ["/inventory", "Inventory"],
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

test("automations create, test, enable, run, approve, retry, duplicate, archive, and audit rules", async ({ request, page }) => {
  await resetDemo(request);
  const create = await request.post("/api/automations/actions", { data: { action: "create-rule", name: "Browser low stock automation", templateId: "auto-template-low-stock", enabled: false, dryRun: true, idempotencyKey: crypto.randomUUID() } });
  expect(create.ok(), await create.text()).toBeTruthy();
  let state = (await create.json()).data;
  const rule = state.automationRules.find((entry: { name: string }) => entry.name === "Browser low stock automation");
  expect(rule.conditions.length).toBeGreaterThan(0);
  const testRun = await request.post("/api/automations/actions", { data: { action: "test-rule", ruleId: rule.id } });
  expect(testRun.ok(), await testRun.text()).toBeTruthy();
  state = (await testRun.json()).data;
  expect(state.automationRuns.some((entry: { status: string }) => entry.status === "dry_run")).toBeTruthy();
  const enable = await request.post("/api/automations/actions", { data: { action: "enable-rule", ruleId: rule.id } });
  expect(enable.ok(), await enable.text()).toBeTruthy();
  const pause = await request.post("/api/automations/actions", { data: { action: "pause-schedule", ruleId: rule.id } });
  expect(pause.ok(), await pause.text()).toBeTruthy();
  const resume = await request.post("/api/automations/actions", { data: { action: "resume-schedule", ruleId: rule.id } });
  expect(resume.ok(), await resume.text()).toBeTruthy();
  const trigger = await request.post("/api/automations/actions", { data: { action: "trigger-run", ruleId: rule.id, samplePayload: { available: 1, sku: "FST-HOOD-001" }, idempotencyKey: crypto.randomUUID() } });
  expect(trigger.ok(), await trigger.text()).toBeTruthy();
  state = (await trigger.json()).data;
  expect(state.automationSteps.length).toBeGreaterThan(0);
  expect(state.activity.some((entry: { entityType: string }) => entry.entityType === "automation_run")).toBeTruthy();
  const event = await request.post("/api/automations/actions", { data: { action: "trigger-event", triggerType: "inventory.below_reorder_point", samplePayload: { id: crypto.randomUUID(), available: 1, reorderPoint: 2, sku: "FST-HOOD-001" }, idempotencyKey: crypto.randomUUID() } });
  expect(event.ok(), await event.text()).toBeTruthy();
  state = (await event.json()).data;
  expect(state.automationEventReceipts.some((entry: { status: string }) => entry.status === "processed")).toBeTruthy();
  const worker = await request.post("/api/automations/actions", { data: { action: "worker-tick", workerId: "playwright-worker", concurrency: 2 } });
  expect(worker.ok(), await worker.text()).toBeTruthy();
  state = (await worker.json()).data;
  expect(state.automationWorkerHeartbeats.some((entry: { workerId: string }) => entry.workerId === "playwright-worker")).toBeTruthy();
  const duplicate = await request.post("/api/automations/actions", { data: { action: "duplicate-rule", ruleId: rule.id } });
  expect(duplicate.ok(), await duplicate.text()).toBeTruthy();
  state = (await duplicate.json()).data;
  expect(state.automationRules.some((entry: { name: string }) => entry.name === "Browser low stock automation copy")).toBeTruthy();
  const archive = await request.post("/api/automations/actions", { data: { action: "archive-rule", ruleId: rule.id } });
  expect(archive.ok(), await archive.text()).toBeTruthy();

  await page.goto("/automations");
  const automationMain = page.getByTestId("app-main");
  await expect(automationMain.getByRole("heading", { name: "Rule builder, run logs, retries, and failures", exact: true })).toBeVisible();
  const builder = page.getByRole("region", { name: "Automation builder" });
  await expect(builder).toBeVisible();
  for (const label of ["Create rule", "Install template", "Test rule", "Enable rule", "Run now", "Send event", "Process tasks", "Pause schedule", "Resume schedule", "Duplicate rule", "Archive rule"]) await expect(builder.getByRole("button", { name: label, exact: true })).toBeVisible();
  await expect(automationMain.getByRole("heading", { name: "Rules", level: 2, exact: true })).toBeVisible();
  await expect(automationMain.getByRole("heading", { name: "Active Runs", level: 2, exact: true })).toBeVisible();
  await expect(automationMain.getByRole("heading", { name: "Run steps", level: 2, exact: true })).toBeVisible();
  await expect(automationMain.getByRole("heading", { name: "Waiting Approval", level: 2, exact: true })).toBeVisible();
  await expect(automationMain.getByRole("heading", { name: "Failed & Dead Letter", level: 2, exact: true })).toBeVisible();
  await expect(automationMain.getByRole("heading", { name: "Event receipts", level: 2, exact: true })).toBeVisible();
  await expect(automationMain.getByRole("heading", { name: "Worker health", level: 2, exact: true })).toBeVisible();
  await expect(automationMain.getByRole("heading", { name: "Execution traces", level: 2, exact: true })).toBeVisible();
  await expect(automationMain.getByRole("heading", { name: "Queue observability", level: 2, exact: true })).toBeVisible();
  await expect(automationMain.getByRole("heading", { name: "Active leases", level: 2, exact: true })).toBeVisible();
  await expect(automationMain.getByText("Queue depth", { exact: true })).toBeVisible();
});

test("AI Center answers with evidence, generates briefs, scenarios, approvals, and history", async ({ request, page }) => {
  await resetDemo(request);
  const ask = await request.post("/api/ai-center/actions", { data: { action: "ask-question", question: "Is Vintage wash heavyweight hoodie active?", saveQuestion: true, provider: "deterministic" } });
  expect(ask.ok(), await ask.text()).toBeTruthy();
  let state = (await ask.json()).data;
  expect(state.aiMessages.some((entry: { role: string; content: string; evidenceIds: string[] }) => entry.role === "assistant" && entry.content.includes("Vintage wash heavyweight hoodie") && entry.content.includes("active") && entry.evidenceIds.length > 0)).toBeTruthy();
  expect(state.aiToolCalls.some((entry: { toolName: string }) => entry.toolName === "ai.internal_records.query")).toBeTruthy();
  const brief = await request.post("/api/ai-center/actions", { data: { action: "daily-brief", provider: "deterministic" } });
  expect(brief.ok(), await brief.text()).toBeTruthy();
  state = (await brief.json()).data;
  expect(state.aiDailyBriefs[0].sections.length).toBeGreaterThan(0);
  const scenario = await request.post("/api/ai-center/actions", { data: { action: "run-scenario", name: "Buy 300 units", prompt: "What happens if I buy 300 units of this SKU?", units: 300, variantId: state.variants[0].id, priceChangePercent: 8, reserveCash: 150 } });
  expect(scenario.ok(), await scenario.text()).toBeTruthy();
  state = (await scenario.json()).data;
  expect(state.aiScenarios.some((entry: { name: string; impacts: { purchaseCommitments: number } }) => entry.name === "Buy 300 units" && entry.impacts.purchaseCommitments > 0)).toBeTruthy();
  const recommendation = state.aiRecommendations.find((entry: { approvalRequired: boolean }) => entry.approvalRequired);
  const saved = await request.post("/api/ai-center/actions", { data: { action: "save-recommendation", recommendationId: recommendation.id } });
  expect(saved.ok(), await saved.text()).toBeTruthy();
  const approval = await request.post("/api/ai-center/actions", { data: { action: "request-approval", recommendationId: recommendation.id, reason: "Playwright owner approval" } });
  expect(approval.ok(), await approval.text()).toBeTruthy();
  state = (await approval.json()).data;
  expect(state.aiApprovalProposals.some((entry: { status: string }) => entry.status === "pending")).toBeTruthy();
  expect(state.automationApprovals.some((entry: { reason?: string }) => entry.reason === "Playwright owner approval")).toBeTruthy();

  await page.goto("/ai-center");
  const aiMain = page.getByTestId("app-main");
  await expect(aiMain.getByRole("heading", { name: "Daily brief and evidence-backed recommendations", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "AI Center actions" })).toBeVisible();
  await expect(aiMain.getByRole("heading", { name: "Safe internal tools", level: 2, exact: true })).toBeVisible();
  await expect(aiMain.getByRole("heading", { name: "Daily operating brief", level: 2, exact: true })).toBeVisible();
  await expect(aiMain.getByRole("heading", { name: "Evidence-backed recommendations", level: 2, exact: true })).toBeVisible();
  await expect(aiMain.getByRole("heading", { name: "Scenario analysis", level: 2, exact: true })).toBeVisible();
  await expect(aiMain.getByRole("heading", { name: "Citations and drilldowns", level: 2, exact: true })).toBeVisible();
  await expect(aiMain.getByRole("link", { name: "FST-HOOD-001", exact: true })).toBeVisible();
  await expect(aiMain.getByText("Buy 300 units", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ask question", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(/Grounded answer saved/);
});

test("browser extension API scans, analyzes, imports, confirms, syncs, and reports failures", async ({ request }) => {
  await resetDemo(request);
  const product = { source: "1688", importedAt: new Date().toISOString(), title: "Playwright 1688 Hoodie", superbuyUrl: "https://detail.1688.com/offer/999.html", supplier: "PW Factory", storeName: "PW Factory Store", images: ["https://img.example.test/pw.jpg"], variants: [{ id: "pw-l", name: "Black / L", options: ["Black", "L"], price: 118 }], price: 118, domesticShipping: 12, minimumOrderQuantity: 3, weight: "650g", sellerRating: 4.7, salesCount: 1200, pageTimestamp: new Date().toISOString() };
  const registration = await request.post("/api/extension/register", { data: { deviceName: "Playwright extension", browser: "Chromium", environment: "local", version: "1.1.0-phase2", permissions: ["storage", "tabs"], idempotencyKey: crypto.randomUUID() } });
  expect(registration.ok(), await registration.text()).toBeTruthy();
  const registered = await registration.json();
  const authHeaders = () => ({ "X-Faust-Device-Id": registered.actionResult.deviceId, "X-Faust-Extension-Token": registered.actionResult.token, "X-Faust-Nonce": crypto.randomUUID() });
  const invalid = await request.post("/api/extension/analyze", { headers: { "X-Faust-Device-Id": registered.actionResult.deviceId, "X-Faust-Extension-Token": "bad-token", "X-Faust-Nonce": crypto.randomUUID() }, data: { product } });
  expect(invalid.status()).toBe(400);
  await expect(invalid.json()).resolves.toMatchObject({ ok: false, message: "Invalid extension token." });
  const replayNonce = crypto.randomUUID();
  const scan = await request.post("/api/extension/scan", { headers: { ...authHeaders(), "X-Faust-Nonce": replayNonce }, data: { payload: product } });
  expect(scan.ok(), await scan.text()).toBeTruthy();
  const replay = await request.post("/api/extension/scan", { headers: { ...authHeaders(), "X-Faust-Nonce": replayNonce }, data: { payload: product } });
  expect(replay.status()).toBe(400);
  await expect(replay.json()).resolves.toMatchObject({ ok: false, message: "Replay detected for extension request." });
  const analyze = await request.post("/api/extension/analyze", { headers: authHeaders(), data: { product, assumptions: { rmbUsdRate: 0.14, targetSalePriceUsd: 65, quantity: 3 } } });
  expect(analyze.ok(), await analyze.text()).toBeTruthy();
  let state = await analyze.json();
  expect(state.actionResult.byMarketplace.length).toBe(5);
  const imported = await request.post("/api/extension/import", { headers: authHeaders(), data: { product, assumptions: { rmbUsdRate: 0.14, targetSalePriceUsd: 65, quantity: 3 }, approved: true, idempotencyKey: crypto.randomUUID() } });
  expect(imported.ok(), await imported.text()).toBeTruthy();
  state = await imported.json();
  const draft = state.data.channelListingDrafts.find((entry: { marketplace: string; title: string }) => entry.marketplace === "Depop" && entry.title.includes("Playwright"));
  expect(draft).toBeTruthy();
  expect(state.data.channelListingDrafts.filter((entry: { variantId: string }) => entry.variantId === draft.variantId).length).toBe(5);
  const second = await request.post("/api/extension/import", { headers: authHeaders(), data: { product, assumptions: { rmbUsdRate: 0.14, targetSalePriceUsd: 65, quantity: 3 }, approved: true, idempotencyKey: crypto.randomUUID() } });
  expect(second.ok(), await second.text()).toBeTruthy();
  state = await second.json();
  expect(state.actionResult.idempotent).toBeTruthy();
  const job = await request.post("/api/extension/publish-job", { headers: authHeaders(), data: { draftId: draft.id, idempotencyKey: crypto.randomUUID() } });
  expect(job.ok(), await job.text()).toBeTruthy();
  const confirm = await request.post("/api/extension/confirm", { headers: authHeaders(), data: { draftId: draft.id, externalListingId: "PW-DEPOP-1", externalUrl: "https://www.depop.com/products/pw-depop-1", finalTitle: "Playwright final title", finalPrice: 66, evidence: { type: "publish_confirmation", currentUrl: "https://www.depop.com/products/pw-depop-1", metadata: { selector: "a[href*='/products/']" } } } });
  expect(confirm.ok(), await confirm.text()).toBeTruthy();
  state = await confirm.json();
  expect(state.data.channelListingDrafts.find((entry: { id: string }) => entry.id === draft.id).externalListingId).toBe("PW-DEPOP-1");
  const sync = await request.post("/api/extension/sync", { headers: authHeaders(), data: { draftId: draft.id, quantity: 2 } });
  expect(sync.ok(), await sync.text()).toBeTruthy();
  const failure = await request.post("/api/extension/error", { headers: authHeaders(), data: { draftId: draft.id, marketplace: "Depop", reason: "Selector changed in controlled test", classification: "retryable", artifact: { type: "dom_snapshot", currentUrl: "https://www.depop.com/products/create", failedSelector: "input[name='title']", pageVersion: "depop-2026.07.phase2", metadata: { dom: { hash: "pw" } } } } });
  expect(failure.ok(), await failure.text()).toBeTruthy();
  state = await failure.json();
  expect(state.data.listingReviewItems.some((entry: { detail: string }) => entry.detail === "Selector changed in controlled test")).toBeTruthy();
  expect(state.data.extensionArtifacts.length).toBeGreaterThanOrEqual(2);
  expect(state.data.extensionActionAudits.some((entry: { action: string }) => entry.action === "report-error")).toBeTruthy();
});

test("import queue manages multiple scans, removal, and catalog completion", async ({ request }) => {
  await resetDemo(request);
  const products = [1, 2, 3].map((index) => ({
    source: "1688",
    importedAt: new Date(Date.now() + index * 1000).toISOString(),
    title: `Queue Review Product ${index}`,
    superbuyUrl: `https://detail.1688.com/offer/queue-${index}.html`,
    supplier: "Queue Factory",
    storeName: "Queue Factory Store",
    images: [`https://cbu01.alicdn.com/img/queue-${index}.jpg`],
    variants: [{ id: `queue-${index}-black`, name: "Black", options: ["Black"], price: 18 + index, stock: 12 }],
    price: 18 + index,
    domesticShipping: 2,
    minimumOrderQuantity: 1,
    weight: "250g",
    pageTimestamp: new Date().toISOString(),
  }));
  for (const product of products) {
    const scan = await request.post("/api/extension/scan", { data: { payload: product } });
    expect(scan.ok(), await scan.text()).toBeTruthy();
  }
  let queueResponse = await request.get("/api/import-queue");
  expect(queueResponse.ok(), await queueResponse.text()).toBeTruthy();
  let queueState = await queueResponse.json();
  expect(queueState.counts.active).toBeGreaterThanOrEqual(3);
  const second = queueState.queue.find((item: { title: string }) => item.title === "Queue Review Product 2");
  expect(second).toBeTruthy();

  const selected = await request.get(`/api/current-product?id=${second.id}`);
  expect(selected.ok(), await selected.text()).toBeTruthy();
  await expect(selected.json()).resolves.toMatchObject({ queueItemId: second.id, product: { title: "Queue Review Product 2" } });

  const remove = await request.post("/api/import-queue", { data: { action: "delete", ids: [second.id] } });
  expect(remove.ok(), await remove.text()).toBeTruthy();
  queueState = await remove.json();
  expect(queueState.queue.some((item: { id: string }) => item.id === second.id)).toBeFalsy();

  const first = queueState.queue.find((item: { title: string }) => item.title === "Queue Review Product 1");
  expect(first).toBeTruthy();
  const product = first.product;
  const time = new Date().toISOString();
  const opportunity = {
    id: crypto.randomUUID(),
    importQueueItemId: first.id,
    product: {
      id: crypto.randomUUID(),
      name: product.title,
      category: product.category,
      description: product.description,
      supplier: { name: product.supplier, storeName: product.storeName, storeUrl: product.supplierStoreUrl },
      sourcing: { superbuyUrl: product.superbuyUrl, original1688Url: product.original1688Url, sourcePrice: product.price, stock: product.stock, minimumOrderQuantity: product.minimumOrderQuantity },
      media: { images: product.images },
      variants: product.variants,
      source: product,
    },
    costs: {
      product: { key: "product", label: "Product Cost", amount: product.price || 0 },
      domesticShipping: { key: "domesticShipping", label: "Domestic China Shipping", amount: product.domesticShipping || 0 },
      internationalShipping: { key: "internationalShipping", label: "International Shipping", amount: product.internationalShipping || 0 },
      packaging: { key: "packaging", label: "Packaging", amount: 0 },
      marketplaceFees: { key: "marketplaceFees", label: "Marketplace Fees", amount: 0, calculated: true },
      paymentProcessing: { key: "paymentProcessing", label: "Payment Processing", amount: 0, calculated: true },
      advertising: { key: "advertising", label: "Advertising", amount: 0 },
      taxes: { key: "taxes", label: "Taxes", amount: 0 },
      storage: { key: "storage", label: "Storage Cost", amount: 0 },
      warehouse: { key: "warehouse", label: "Warehouse Cost", amount: 0 },
      returns: { key: "returns", label: "Expected Returns", amount: 0 },
      miscellaneous: { key: "miscellaneous", label: "Miscellaneous", amount: 0 },
    },
    listing: { marketplaceId: "depop", title: product.title, description: product.description || "", category: product.category || "", tags: [], shippingMethod: "", shippingPrice: 0, status: "draft" },
    salePrice: 45,
    notes: "Playwright import queue completion.",
    createdAt: time,
    updatedAt: time,
  };
  const created = await request.post("/api/opportunities", { data: opportunity });
  expect(created.ok(), await created.text()).toBeTruthy();
  queueResponse = await request.get("/api/import-queue");
  queueState = await queueResponse.json();
  expect(queueState.queue.some((item: { id: string }) => item.id === first.id)).toBeFalsy();
  expect(queueState.counts.completed).toBeGreaterThanOrEqual(1);
});

test("product lifecycle stays synchronized across active views, archive, restore, and hard delete", async ({ request, page }) => {
  await resetDemo(request);
  const unique = crypto.randomUUID().slice(0, 8);
  const title = `D6 Sync Hoodie ${unique}`;
  const sourceUrl = `https://detail.1688.com/offer/d6-${unique}.html`;
  const product = { source: "1688", importedAt: new Date().toISOString(), title, superbuyUrl: sourceUrl, supplier: "D6 Sync Factory", storeName: "D6 Sync Factory", images: ["https://img.example.test/d6.jpg"], variants: [{ id: "d6-l", name: "Black / L", options: ["Black", "L"], price: 120 }], price: 120, domesticShipping: 10, minimumOrderQuantity: 2, weight: "600g", sellerRating: 4.8, salesCount: 640, pageTimestamp: new Date().toISOString() };

  const registration = await request.post("/api/extension/register", { data: { deviceName: "D6 lifecycle extension", browser: "Chromium", environment: "local", version: "1.1.0-phase2", permissions: ["storage", "tabs"], idempotencyKey: crypto.randomUUID() } });
  expect(registration.ok(), await registration.text()).toBeTruthy();
  const registered = await registration.json();
  const authHeaders = () => ({ "X-Faust-Device-Id": registered.actionResult.deviceId, "X-Faust-Extension-Token": registered.actionResult.token, "X-Faust-Nonce": crypto.randomUUID() });

  const imported = await request.post("/api/extension/import", { headers: authHeaders(), data: { product, assumptions: { rmbUsdRate: 0.14, targetSalePriceUsd: 72, quantity: 2 }, approved: true, idempotencyKey: crypto.randomUUID() } });
  expect(imported.ok(), await imported.text()).toBeTruthy();
  let state = (await imported.json()).data;
  const variant = state.variants.find((entry: { productId: string; sku: string }) => state.products.find((item: { id: string; title: string }) => item.id === entry.productId && item.title === title));
  expect(variant).toBeTruthy();
  const draft = state.channelListingDrafts.find((entry: { variantId: string; marketplace: string }) => entry.variantId === variant.id && entry.marketplace === "Depop");
  expect(draft).toBeTruthy();

  const confirm = await request.post("/api/extension/confirm", { headers: authHeaders(), data: { draftId: draft.id, externalListingId: `D6-DEPOP-${unique}`, externalUrl: `https://www.depop.com/products/d6-${unique}`, finalTitle: title, finalPrice: 72 } });
  expect(confirm.ok(), await confirm.text()).toBeTruthy();
  state = (await confirm.json()).data;
  expect(state.products.find((entry: { title: string }) => entry.title === title).status).toBe("draft");

  await page.goto("/catalog");
  let appMain = page.getByTestId("app-main");
  await expect(appMain.getByText(title, { exact: true })).toBeVisible();
  await page.goto(`/search?q=${encodeURIComponent(title)}`);
  appMain = page.getByTestId("app-main");
  await expect(appMain.getByRole("link", { name: new RegExp(title) })).toBeVisible();
  await page.goto("/inventory");
  appMain = page.getByTestId("app-main");
  await expect(appMain.getByRole("heading", { name: variant.sku, exact: true })).toBeVisible();
  await page.goto("/listings");
  appMain = page.getByTestId("app-main");
  await expect(appMain.getByRole("cell", { name: variant.sku, exact: true })).toHaveCount(5);
  await page.goto("/analytics");
  appMain = page.getByTestId("app-main");
  await expect(appMain.getByRole("link", { name: variant.sku, exact: true })).toBeVisible();

  let ask = await request.post("/api/ai-center/actions", { data: { action: "ask-question", question: "How many active products do I have?", provider: "deterministic" } });
  expect(ask.ok(), await ask.text()).toBeTruthy();
  state = (await ask.json()).data;
  expect(state.aiMessages.at(-1).content).toContain("active product SKU");

  const archived = await request.post("/api/products/actions", { data: { action: "delete", variantId: variant.id } });
  expect(archived.ok(), await archived.text()).toBeTruthy();
  state = (await archived.json()).data;
  expect(state.products.find((entry: { title: string }) => entry.title === title).status).toBe("paused");
  expect(state.variants.find((entry: { id: string }) => entry.id === variant.id).active).toBeFalsy();

  for (const route of ["/catalog", `/search?q=${encodeURIComponent(title)}`, "/inventory", "/listings", "/analytics"] as const) {
    await page.goto(route);
    await expect(page.getByTestId("app-main").getByText(title, { exact: true })).toHaveCount(0);
    await expect(page.getByTestId("app-main").getByText(variant.sku, { exact: true })).toHaveCount(0);
  }
  ask = await request.post("/api/ai-center/actions", { data: { action: "ask-question", question: "Show my archived products.", provider: "deterministic" } });
  expect(ask.ok(), await ask.text()).toBeTruthy();
  state = (await ask.json()).data;
  expect(state.aiMessages.at(-1).content).toContain(title);

  const restored = await request.post("/api/products/actions", { data: { action: "restore", variantId: variant.id } });
  expect(restored.ok(), await restored.text()).toBeTruthy();
  state = (await restored.json()).data;
  expect(state.products.filter((entry: { title: string }) => entry.title === title)).toHaveLength(1);
  expect(state.variants.find((entry: { id: string }) => entry.id === variant.id).active).toBeTruthy();
  await page.goto("/catalog");
  await expect(page.getByTestId("app-main").getByText(title, { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("app-main").getByText(title, { exact: true })).toBeVisible();

  const duplicate = await request.post("/api/products/actions", { data: { action: "duplicate", variantId: variant.id } });
  expect(duplicate.ok(), await duplicate.text()).toBeTruthy();
  state = (await duplicate.json()).data;
  const duplicateVariant = state.variants.find((entry: { sku: string }) => entry.sku.startsWith(`${variant.sku}-COPY`));
  const duplicateProduct = state.products.find((entry: { id: string }) => entry.id === duplicateVariant.productId);
  expect(duplicateProduct.title).toBe(`${title} copy`);
  const hardDeleted = await request.post("/api/products/actions", { data: { action: "delete", variantId: duplicateVariant.id } });
  expect(hardDeleted.ok(), await hardDeleted.text()).toBeTruthy();
  state = (await hardDeleted.json()).data;
  expect(state.variants.some((entry: { id: string }) => entry.id === duplicateVariant.id)).toBeFalsy();
  expect(state.products.some((entry: { id: string }) => entry.id === duplicateProduct.id)).toBeFalsy();
  await page.goto("/catalog");
  await expect(page.getByTestId("app-main").getByText(`${title} copy`, { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("app-main").getByText(`${title} copy`, { exact: true })).toHaveCount(0);
});

test("production health API reports migration, storage, worker, extension, and provider readiness", async ({ request }) => {
  await resetDemo(request);
  const response = await request.get("/api/health");
  expect(response.ok(), await response.text()).toBeTruthy();
  const health = await response.json();
  expect(health.checks.migrations.ready).toBeTruthy();
  expect(health.checks.storage.ready).toBeTruthy();
  expect(health.checks.worker.gracefulShutdown).toBeTruthy();
  expect(health.checks.extension).toBeTruthy();
  expect(health.checks.providers.marketplaces.allFiveLiveCredentials).toBe("not_connected_by_design");
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
  const shippingMain = page.getByTestId("app-main");
  const labelWorkflow = shippingMain.locator("section").filter({ has: page.getByRole("heading", { name: "Rate shopping & labels", exact: true }) });
  await expect(shippingMain.getByRole("heading", { name: "Warehouse fulfillment center", exact: true })).toBeVisible();
  await expect(shippingMain.getByRole("cell", { name: "FO-1042", exact: true })).toBeVisible();
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
  await expect(labelWorkflow.getByText("USPS Mock Ground Advantage", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Select best rate" }).click();
  await expect(page.getByRole("status")).toContainText("Rate selected.");
  await expect(labelWorkflow.getByText(/USPS Mock - Ground Advantage - postage/i)).toBeVisible();
  await page.getByRole("button", { name: "Generate test label" }).click();
  await expect(page.getByRole("status")).toContainText("Label generated.");
  await page.getByRole("button", { name: "Print/reprint" }).click();
  await expect(page.getByRole("status")).toContainText("Label print recorded.");
  await page.getByRole("button", { name: "Void label" }).click();
  await expect(page.getByRole("status")).toContainText("Label voided.");
  await page.getByRole("button", { name: "Regenerate label" }).click();
  await expect(page.getByRole("status")).toContainText("Label regenerated.");
  await labelWorkflow.getByRole("button", { name: "Dispatch", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Shipment dispatched.");
  const trackingCenter = shippingMain.locator("section").filter({ has: page.getByRole("heading", { name: "Tracking center", exact: true }) });
  await expect(trackingCenter.locator(".border-l").getByText(/Carrier accepted package/i)).toBeVisible();
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
  await page.goto("/orders"); const appMain = page.getByTestId("app-main"); await expect(appMain.getByRole("row", { name: /FO-1042 Depop Jordan Reed/i })).toBeVisible();
  await page.goto("/purchasing"); await expect(page.getByText("DEMO-17TRACK-1042")).toBeVisible();
});

test("inventory adjustment API updates the demo balance with an audit trail", async ({ request }) => {
  await resetDemo(request); const before = await request.get("/api/operating-system"); expect(before.ok()).toBeTruthy(); const snapshot = await before.json(); const balance = snapshot.data.balances[0];
  const response = await request.post("/api/inventory/adjust", { data: { balanceId: balance.id, quantity: 1, reason: "Playwright direct API verification", idempotencyKey: crypto.randomUUID() } }); const body = await response.text(); expect(response.ok(), body).toBeTruthy(); const updated = JSON.parse(body).data;
  expect(updated.balances.find((entry: { id: string }) => entry.id === balance.id).onHand).toBe(balance.onHand + 1); expect(updated.stockMovements.some((entry: { referenceType?: string }) => entry.referenceType === "inventory_adjustment")).toBeTruthy(); expect(updated.activity.some((entry: { entityType: string }) => entry.entityType === "inventory_balance")).toBeTruthy();
});

test("finance API persists expense, payout, budget, tax, allocation, and forecast workflows", async ({ request }) => {
  await resetDemo(request);
  const expense = await request.post("/api/finance/actions", { data: { action: "create-expense", vendor: "API Vendor", category: "Software", amount: 42, recurring: "monthly", receiptStatus: "pending_attachment" } }); expect(expense.ok(), await expense.text()).toBeTruthy(); let state = (await expense.json()).data; expect(state.expenses.some((entry: { vendor: string }) => entry.vendor === "API Vendor")).toBeTruthy();
  const payout = await request.post("/api/finance/actions", { data: { action: "reconcile-payout", marketplace: "Depop", expectedAmount: 81.18, actualAmount: 80, externalPayoutId: "API-PAYOUT" } }); expect(payout.ok(), await payout.text()).toBeTruthy(); state = (await payout.json()).data; expect(state.payouts.some((entry: { externalPayoutId: string }) => entry.externalPayoutId === "API-PAYOUT")).toBeTruthy(); expect(state.payoutReconciliations.some((entry: { status: string }) => entry.status === "discrepancy")).toBeTruthy();
  const budget = await request.post("/api/finance/actions", { data: { action: "create-budget", month: "2026-07", category: "Advertising", amount: 250 } }); expect(budget.ok(), await budget.text()).toBeTruthy(); state = (await budget.json()).data; expect(state.budgets.some((entry: { category: string }) => entry.category === "Advertising")).toBeTruthy();
  const tax = await request.post("/api/finance/actions", { data: { action: "reserve-tax", amount: 25, basisAmount: 140, rate: 0.18, notes: "API reserve" } }); expect(tax.ok(), await tax.text()).toBeTruthy(); state = (await tax.json()).data; expect(state.taxReserveMovements.some((entry: { notes: string }) => entry.notes === "API reserve")).toBeTruthy();
  const forecast = await request.post("/api/finance/actions", { data: { action: "configure-forecast", scenario: "expected", revenueMultiplier: 1.08, expenseMultiplier: 1.02, assumption: "API scenario" } }); expect(forecast.ok(), await forecast.text()).toBeTruthy(); state = (await forecast.json()).data; expect(state.forecasts.some((entry: { scenarios?: unknown[] }) => entry.scenarios?.length)).toBeTruthy();
});

test("wholesale core API persists lots, FIFO allocations, journals, jobs, and channel risk locks", async ({ request }) => {
  await resetDemo(request);
  let state = (await (await request.get("/api/operating-system")).json()).data;
  const variant = state.variants[0];
  const order = state.orders.find((entry: { number: string }) => entry.number === "FO-1042");
  const orderItem = order.items[0];
  const listing = state.listings[0];
  const batch = await request.post("/api/wholesale-core", { data: { action: "receive-batch", reference: "PW-WHOLESALE-001", supplierId: state.suppliers[0].id, purchaseOrderId: state.purchaseOrders[0].id, currency: "RMB", rmbUsdRate: 0.14, items: [{ variantId: variant.id, quantity: 4, unitCost: 100, physicalSku: "PW-HOOD-L", locationId: state.locations[0].id }], landedCosts: [{ type: "international_freight", description: "Playwright freight", amount: 40, currency: "RMB", allocationMethod: "by_quantity" }], idempotencyKey: crypto.randomUUID() } });
  expect(batch.ok(), await batch.text()).toBeTruthy(); state = (await batch.json()).data;
  expect(state.purchaseBatches.length).toBe(1); expect(state.inventoryLots.length).toBe(1); expect(state.journalEntries.length).toBeGreaterThan(0);
  const fifo = await request.post("/api/wholesale-core", { data: { action: "allocate-fifo", orderId: order.id, orderItemId: orderItem.id, idempotencyKey: crypto.randomUUID() } });
  expect(fifo.ok(), await fifo.text()).toBeTruthy(); state = (await fifo.json()).data;
  expect(state.orderItemCostAllocations.length).toBe(1); expect(state.inventoryLots[0].quantityRemaining).toBe(3);
  const returned = await request.post("/api/wholesale-core", { data: { action: "receive-return", orderId: order.id, orderItemId: orderItem.id, quantity: 1, returnId: crypto.randomUUID(), mode: "returned_goods_lot", idempotencyKey: crypto.randomUUID() } });
  expect(returned.ok(), await returned.text()).toBeTruthy(); state = (await returned.json()).data;
  expect(state.inventoryLots.some((lot: { condition: string }) => lot.condition === "returned_goods")).toBeTruthy();
  const sync = await request.post("/api/wholesale-core", { data: { action: "sync-channel-risk", variantId: variant.id, listingId: listing.id, desiredQuantity: 20, physicalSku: "PW-HOOD-L", idempotencyKey: crypto.randomUUID() } });
  expect(sync.ok(), await sync.text()).toBeTruthy(); state = (await sync.json()).data;
  expect(state.physicalSkuMappings.some((mapping: { physicalSku: string }) => mapping.physicalSku === "PW-HOOD-L")).toBeTruthy(); expect(state.inventoryRiskLocks.some((lock: { status: string }) => lock.status === "active")).toBeTruthy();
  const outbox = await request.post("/api/wholesale-core", { data: { action: "process-outbox", maxAttempts: 1 } });
  expect(outbox.ok(), await outbox.text()).toBeTruthy(); state = (await outbox.json()).data;
  expect(state.deadLetters.length).toBeGreaterThan(0);
});

test("listings API creates five channel drafts and coordinates publish, sync, manual fallback, and sold delists", async ({ request }) => {
  await resetDemo(request);
  let state = (await (await request.get("/api/operating-system")).json()).data;
  const variant = state.variants[0];
  const create = await request.post("/api/listings/actions", { data: { action: "create-five-drafts", variantId: variant.id, physicalSku: "PW-HOOD-L", basePrice: 90, imageUrls: ["/hoodie.png"], idempotencyKey: crypto.randomUUID() } });
  expect(create.ok(), await create.text()).toBeTruthy(); state = (await create.json()).data;
  expect(state.channelListingDrafts.length).toBe(5); expect(state.physicalSkuMappings.filter((entry: { physicalSku: string }) => entry.physicalSku === "PW-HOOD-L").length).toBe(5);
  const depop = state.channelListingDrafts.find((entry: { marketplace: string }) => entry.marketplace === "Depop");
  const etsy = state.channelListingDrafts.find((entry: { marketplace: string }) => entry.marketplace === "Etsy");
  const published = await request.post("/api/listings/actions", { data: { action: "publish-draft", draftId: depop.id, idempotencyKey: crypto.randomUUID() } });
  expect(published.ok(), await published.text()).toBeTruthy(); state = (await published.json()).data;
  expect(state.channelListingDrafts.find((entry: { id: string }) => entry.id === depop.id).externalListingId).toBeTruthy();
  const manual = await request.post("/api/listings/actions", { data: { action: "publish-draft", draftId: etsy.id, idempotencyKey: crypto.randomUUID() } });
  expect(manual.ok(), await manual.text()).toBeTruthy(); state = (await manual.json()).data;
  expect(state.channelListingDrafts.find((entry: { id: string }) => entry.id === etsy.id).status).toBe("manual_required");
  const confirmed = await request.post("/api/listings/actions", { data: { action: "confirm-external", draftId: etsy.id, externalListingId: "ETSY-MANUAL-1", externalUrl: "https://example.test/etsy/manual-1", idempotencyKey: crypto.randomUUID() } });
  expect(confirmed.ok(), await confirmed.text()).toBeTruthy(); state = (await confirmed.json()).data;
  expect(state.channelListingDrafts.find((entry: { id: string }) => entry.id === etsy.id).externalUrl).toContain("etsy");
  const risk = await request.post("/api/listings/actions", { data: { action: "sync-quantity", draftId: depop.id, quantity: 99, idempotencyKey: crypto.randomUUID() } });
  expect(risk.ok(), await risk.text()).toBeTruthy(); state = (await risk.json()).data;
  expect(state.inventoryRiskLocks.some((entry: { reason: string }) => entry.reason === "oversell_risk")).toBeTruthy();
  const sold = await request.post("/api/listings/actions", { data: { action: "coordinate-sold", draftId: depop.id, idempotencyKey: crypto.randomUUID() } });
  expect(sold.ok(), await sold.text()).toBeTruthy(); state = (await sold.json()).data;
  expect(state.channelListingDrafts.filter((entry: { status: string }) => entry.status === "delisted").length).toBeGreaterThanOrEqual(4);
});

test("purchasing API persists 1688 PO approvals, payments, receiving, claims, lots, and reorders", async ({ request, page }) => {
  await resetDemo(request);
  let state = (await (await request.get("/api/operating-system")).json()).data;
  const supplier = state.suppliers[0];
  const variant = state.variants[0];
  const create = await request.post("/api/purchasing/actions", { data: { action: "create-1688-po", supplierId: supplier.id, reference: "PW-1688-001", currency: "RMB", exchangeRate: 0.14, items: [{ variantId: variant.id, expectedQuantity: 6, unitCost: 118 }], domesticFreight: 48, internationalFreight: 32, duties: 8, customs: 4, idempotencyKey: crypto.randomUUID() } });
  expect(create.ok(), await create.text()).toBeTruthy(); state = (await create.json()).data;
  const po = state.purchaseOrders.find((entry: { reference: string }) => entry.reference === "PW-1688-001");
  expect(po.status).toBe("draft");
  expect(state.purchaseApprovals.some((entry: { purchaseOrderId: string; status: string }) => entry.purchaseOrderId === po.id && entry.status === "requested")).toBeTruthy();
  expect(state.transactions.some((entry: { purchaseOrderId: string; category: string }) => entry.purchaseOrderId === po.id && entry.category === "Purchase commitment")).toBeTruthy();

  const approved = await request.post("/api/purchasing/actions", { data: { action: "approve-po", purchaseOrderId: po.id, approved: true, reason: "Playwright replenishment approval" } });
  expect(approved.ok(), await approved.text()).toBeTruthy(); state = (await approved.json()).data;
  expect(state.purchaseOrders.find((entry: { id: string }) => entry.id === po.id).status).toBe("ordered");

  const deposit = await request.post("/api/purchasing/actions", { data: { action: "record-payment", purchaseOrderId: po.id, type: "deposit", currency: "RMB", amountOriginal: 300, exchangeRate: 0.14, idempotencyKey: crypto.randomUUID() } });
  expect(deposit.ok(), await deposit.text()).toBeTruthy(); state = (await deposit.json()).data;
  expect(state.purchasePayments.some((entry: { purchaseOrderId: string; type: string }) => entry.purchaseOrderId === po.id && entry.type === "deposit")).toBeTruthy();

  const refreshedPo = state.purchaseOrders.find((entry: { id: string }) => entry.id === po.id);
  const received = await request.post("/api/purchasing/actions", { data: { action: "receive-parcel-to-lots", purchaseOrderId: refreshedPo.id, rows: [{ purchaseOrderItemId: refreshedPo.items[0].id, receivedQuantity: 5, damagedQuantity: 1, notes: "Playwright damaged unit" }], idempotencyKey: crypto.randomUUID() } });
  expect(received.ok(), await received.text()).toBeTruthy(); state = (await received.json()).data;
  expect(state.receivingSessions.some((entry: { purchaseOrderId: string; status: string }) => entry.purchaseOrderId === po.id && entry.status === "issue")).toBeTruthy();
  expect(state.supplierClaims.some((entry: { purchaseOrderId: string; type: string }) => entry.purchaseOrderId === po.id && entry.type === "damaged")).toBeTruthy();
  expect(state.inventoryLots.some((entry: { variantId: string; quantityReceived: number }) => entry.variantId === variant.id && entry.quantityReceived === 5)).toBeTruthy();

  const reorders = await request.post("/api/purchasing/actions", { data: { action: "generate-reorders" } });
  expect(reorders.ok(), await reorders.text()).toBeTruthy(); state = (await reorders.json()).data;
  expect(state.reorderRecommendations.length).toBeGreaterThanOrEqual(0);

  await page.goto("/purchasing");
  const purchasingMain = page.getByTestId("app-main");
  await expect(purchasingMain.getByRole("heading", { name: "Purchasing & inbound", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Purchasing workflows" })).toBeVisible();
  await expect(purchasingMain.getByRole("heading", { name: "1688 purchase orders", level: 2, exact: true })).toBeVisible();
  await expect(purchasingMain.getByRole("heading", { name: "Parcel-to-lot receiving", level: 2, exact: true })).toBeVisible();
});

test("analytics decision engine supports filtering, drilldowns, and CSV export", async ({ request, page }) => {
  await resetDemo(request);
  const apiCreate = await request.post("/api/analytics/reports", { data: { action: "create-report", name: "API saved report", sections: ["Product Analytics"], metrics: ["capitalUtilization"], filters: { marketplace: "Depop", sku: "FST-HOOD-001" }, drilldowns: ["sku", "lot"], scheduleFrequency: "weekly", recipients: ["ops@example.test"], idempotencyKey: crypto.randomUUID() } });
  expect(apiCreate.ok(), await apiCreate.text()).toBeTruthy();
  const createdReport = (await apiCreate.json()).actionResult;
  const apiDuplicate = await request.post("/api/analytics/reports", { data: { action: "duplicate-report", reportId: createdReport.id } });
  expect(apiDuplicate.ok(), await apiDuplicate.text()).toBeTruthy();
  const duplicateReport = (await apiDuplicate.json()).actionResult;
  expect(duplicateReport.id).not.toBe(createdReport.id);
  expect(duplicateReport.name).toBe("API saved report copy");
  expect(duplicateReport.filters).toEqual(createdReport.filters);
  expect(duplicateReport.metrics).toEqual(createdReport.metrics);
  expect(duplicateReport.drilldowns).toEqual(createdReport.drilldowns);
  expect(duplicateReport.schedule.frequency).toBe(createdReport.schedule.frequency);
  expect(duplicateReport.schedule.recipients).toEqual(createdReport.schedule.recipients);
  const reloadedReports = await request.get("/api/analytics/reports");
  expect(reloadedReports.ok(), await reloadedReports.text()).toBeTruthy();
  const reloadedBody = await reloadedReports.json();
  expect(reloadedBody.analytics.reports.some((report: { id: string; name: string }) => report.id === createdReport.id && report.name === "API saved report")).toBeTruthy();
  expect(reloadedBody.analytics.reports.some((report: { id: string; name: string }) => report.id === duplicateReport.id && report.name === "API saved report copy")).toBeTruthy();
  await resetDemo(request);
  await page.goto("/analytics");
  const analyticsMain = page.getByTestId("app-main");
  await expect(analyticsMain.getByRole("heading", { name: "Business trends and drill-down comparisons", exact: true })).toBeVisible();
  for (const section of ["Reporting controls", "Product Analytics", "Channel Analytics", "Supplier Analytics", "Purchasing Analytics", "Inventory Analytics", "Fulfillment Analytics", "Finance Analytics", "Customer Analytics", "Geographic Analytics", "Saved Reports"]) {
    await expect(analyticsMain.getByRole("heading", { name: section, level: 2, exact: true })).toBeVisible();
  }
  await page.locator('select[name="marketplace"]').selectOption("Depop");
  await page.locator('select[name="sku"]').selectOption("FST-HOOD-001");
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await expect(page).toHaveURL(/marketplace=Depop/);
  const productAnalytics = analyticsMain.locator("section").filter({ has: page.getByRole("heading", { name: "Product Analytics", level: 2, exact: true }) });
  await expect(productAnalytics.getByRole("link", { name: "FST-HOOD-001", exact: true })).toBeVisible();
  const inventoryValueCard = analyticsMain.locator("article").filter({ has: page.getByText("Inventory value", { exact: true }) });
  await expect(inventoryValueCard).toBeVisible();
  await expect(inventoryValueCard.getByRole("link", { name: /open source records/i })).toBeVisible();
  const reportBuilder = page.getByRole("region", { name: "Analytics report builder" });
  await expect(reportBuilder).toBeVisible();
  for (const label of ["Create saved report", "Save active filters", "Duplicate report", "Record export run"]) {
    const responsePromise = page.waitForResponse((response) => response.url().includes("/api/analytics/reports") && response.request().method() === "POST");
    await reportBuilder.getByRole("button", { name: label, exact: true }).click();
    const response = await responsePromise; expect(response.ok(), await response.text()).toBeTruthy();
    await expect(reportBuilder.getByRole("status")).toContainText(/saved/i);
  }
  await page.reload();
  const savedReports = analyticsMain.locator("section").filter({ has: page.getByRole("heading", { name: "Saved Reports", level: 2, exact: true }) });
  await expect(savedReports.getByRole("link", { name: "SKU capital utilization review", exact: true })).toBeVisible();
  await expect(savedReports.getByRole("link", { name: "SKU capital utilization review copy", exact: true })).toBeVisible();
  await expect(savedReports.getByText("Filter preset: SKU capital utilization review filters", { exact: true })).toBeVisible();
  await expect(savedReports.getByText("Filter preset: SKU capital utilization review copy filters", { exact: true })).toBeVisible();
  await expect(savedReports.getByText(/completed .* rows/i)).toBeVisible();
  const csv = await request.get("/api/exports/analytics?marketplace=Depop");
  expect(csv.ok(), await csv.text()).toBeTruthy();
  expect(await csv.text()).toContain("executive");
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

test("finance workspace exposes ledger, reconciliation, payout, cash, budget, tax, and forecast workflows", async ({ request, page }) => {
  await resetDemo(request);
  await page.goto("/finance");
  const financeMain = page.getByTestId("app-main");
  await expect(financeMain.getByRole("heading", { name: "Ledger, payout reconciliation, cash, and planning", exact: true })).toBeVisible();
  for (const section of ["Finance Overview", "Deployable Cash Formula", "Cash Flow", "Transaction Ledger", "Revenue", "Order Reconciliation", "Expenses", "COGS", "Fees", "Payouts", "Payout Reconciliation", "Inventory Value", "Tax Reserve", "Reinvestment", "Budgets", "Forecasts"]) {
    await expect(financeMain.getByRole("heading", { name: section, level: 2, exact: true })).toBeVisible();
  }
  const revenueSection = financeMain.locator("section").filter({ has: page.getByRole("heading", { name: "Revenue", exact: true }) });
  await expect(revenueSection.getByText("FO-1042", { exact: true })).toBeVisible();
  const deployableCashSection = financeMain.locator("section").filter({ has: page.getByRole("heading", { name: "Deployable Cash Formula", exact: true }) });
  await expect(deployableCashSection).toBeVisible();
  await expect(deployableCashSection.getByText("Deployable cash", { exact: true })).toBeVisible();
  const forecastsSection = financeMain.locator("section").filter({ has: page.getByRole("heading", { name: "Forecasts", exact: true }) });
  await expect(forecastsSection.getByText(/Assumptions:/i)).toBeVisible();
  const workflows = page.getByRole("region", { name: "Finance workflows" });
  await expect(workflows).toBeVisible();
  for (const label of ["Create expense", "Edit expense", "Reconcile payout", "Create budget", "Reserve movement", "Configure forecast"]) {
    const responsePromise = page.waitForResponse((response) => response.url().includes("/api/finance/actions") && response.request().method() === "POST");
    await workflows.getByRole("button", { name: label, exact: true }).click();
    const response = await responsePromise; expect(response.ok(), await response.text()).toBeTruthy();
    await expect(workflows.getByRole("status")).toContainText(/saved/i);
  }
  await workflows.getByRole("button", { name: "Simulate allocation", exact: true }).click();
  await expect(workflows.getByRole("status")).toContainText(/saved/i);
  await page.reload();
  await expect(page.getByTestId("app-main").getByRole("heading", { name: "Transaction Ledger", exact: true })).toBeVisible();
  const refreshedFinanceMain = page.getByTestId("app-main");
  const refreshedExpensesSection = refreshedFinanceMain.locator("section").filter({ has: page.getByRole("heading", { name: "Expenses", level: 2, exact: true }) });
  await expect(refreshedExpensesSection.getByText("Edited vendor · Software", { exact: true })).toBeVisible();
});
