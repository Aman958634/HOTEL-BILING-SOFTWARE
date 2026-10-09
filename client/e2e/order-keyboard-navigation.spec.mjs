import { expect, test } from "@playwright/test";

const manager = { email: "browser-admin@test.invalid", password: "RoleMatrix@123" };

const login = async (page) => {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Email address").fill(manager.email);
  await page.getByRole("textbox", { name: "Password" }).fill(manager.password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/admin/);
};

const pressTabUntilFocused = async (page, target, limit = 24) => {
  for (let index = 0; index < limit; index += 1) {
    if (await target.evaluate((element) => document.activeElement === element)) return;
    await page.keyboard.press("Tab");
  }
  await expect(target).toBeFocused();
};

const expectConnectedDesktopColumns = async (dialog) => {
  const left = dialog.locator("[data-order-form-left='true']");
  const summary = dialog.locator("[data-order-summary='true']");
  await expect(left).toBeVisible();
  await expect(summary).toBeVisible();
  const [leftBox, summaryBox] = await Promise.all([left.boundingBox(), summary.boundingBox()]);
  expect(leftBox).not.toBeNull();
  expect(summaryBox).not.toBeNull();
  expect(Math.abs(leftBox.y - summaryBox.y)).toBeLessThanOrEqual(1);
  expect(Math.abs((leftBox.x + leftBox.width) - summaryBox.x)).toBeLessThanOrEqual(1);
};

test("Create New Order moves from Menu Search through menu cards, cart and explicit submission", async ({ page }) => {
  // A cold Vite transform can legitimately delay the modal's authenticated
  // menu/table dependency requests on Windows. Wait for the real control
  // instead of relying on a fixed delay while preserving a bounded test run.
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1920, height: 1080 });
  let submissions = 0;
  // Entitlement is enforced by the fixture API for operational requests. Stub
  // only the presentation endpoint so this focused keyboard test cannot be
  // blocked by unrelated subscription-screen rendering.
  await page.route("**/api/v1/admin/billing/subscription", async (route) => {
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, data: { status: "active", entitlementState: "SUBSCRIPTION_ACTIVE", planName: "Browser Verification" } }) });
  });
  await page.route("**/api/v1/orders", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    submissions += 1;
    await route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ message: "Keyboard test submission intercepted" }) });
  });

  await login(page);
  await page.goto("/dashboard/admin/orders", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Create Order", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: /create new order/i });
  await expectConnectedDesktopColumns(dialog);
  await page.setViewportSize({ width: 1366, height: 768 });
  await expectConnectedDesktopColumns(dialog);
  const dineIn = dialog.getByRole("button", { name: "Dine In", exact: true });
  const takeaway = dialog.getByRole("button", { name: "Take Away", exact: true });
  const delivery = dialog.getByRole("button", { name: "Delivery", exact: true });
  await expect(dineIn).toBeFocused();

  await page.keyboard.press("ArrowRight");
  await expect(takeaway).toBeFocused();
  await expect(dineIn).toHaveClass(/border-brand-600/);
  await page.keyboard.press("ArrowRight");
  await expect(delivery).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(takeaway).toBeFocused();

  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Enter");
  const table = dialog.getByLabel("Table");
  await expect(table).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press("ArrowDown");
  await expect(table).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(table).not.toHaveValue("");

  const menuSearch = dialog.getByLabel("Search food items");
  await pressTabUntilFocused(page, menuSearch);
  const menuItems = dialog.locator("[data-order-menu-item='true']");
  await expect(menuItems.first()).toBeVisible();

  // Arrow Down is the intentional hand-off from the editable search field.
  await page.keyboard.press("ArrowDown");
  await expect(menuItems.first()).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(menuItems.nth(1)).toBeFocused();
  const selectedMenuItem = await menuItems.nth(1).innerText();
  await page.keyboard.press("Enter");

  const cartRow = dialog.locator("tr[data-order-cart-item]").first();
  await expect(cartRow).toBeVisible();
  await expect(cartRow).toContainText(selectedMenuItem.split("\n")[0]);
  for (let index = 0; index < 6 && !await cartRow.evaluate((element) => document.activeElement === element); index += 1) {
    await page.keyboard.press("ArrowDown");
  }
  await expect(cartRow).toBeFocused();
  await page.keyboard.press("+");
  await expect(cartRow.locator("span.min-w-9")).toHaveText("2");

  // Native category selection remains intact; returning to search still hands
  // Arrow Down to the newly filtered menu grid.
  const category = dialog.getByLabel("Filter by category");
  await pressTabUntilFocused(page, category, 48);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Shift+Tab");
  await expect(menuSearch).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(menuItems.first()).toBeFocused();

  // No request is made while focus moves or quantities change.
  expect(submissions).toBe(0);
  const createOrder = dialog.getByRole("button", { name: "Create Order", exact: true });
  await pressTabUntilFocused(page, createOrder, 30);
  await page.keyboard.press("Enter");
  await expect.poll(() => submissions).toBe(1);

  await page.setViewportSize({ width: 390, height: 844 });
  const layoutMetrics = await dialog.locator("[data-order-form-layout='true']").evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(layoutMetrics.scrollWidth).toBeLessThanOrEqual(layoutMetrics.clientWidth + 1);
  await expect(dialog.getByText("Order Summary", { exact: true })).toBeVisible();
});
