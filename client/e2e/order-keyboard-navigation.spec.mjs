import { expect, test } from "@playwright/test";

const manager = { email: "browser-admin@test.invalid", password: "RoleMatrix@123" };

const login = async (page) => {
  await page.goto("/login");
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

test("Create New Order supports keyboard-only type, menu, cart and explicit submission", async ({ page }) => {
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
  await page.goto("/dashboard/admin/orders");
  await page.getByRole("button", { name: "Create Order", exact: true }).click();

  const dialog = page.getByRole("dialog", { name: /create new order/i });
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
  await expect(table).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await expect(table).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(table).not.toHaveValue("");

  const menuSearch = dialog.getByLabel("Search food items");
  await pressTabUntilFocused(page, menuSearch);
  await page.keyboard.type("Paneer Tikka");
  const menuItem = dialog.getByRole("button", { name: /paneer tikka/i }).first();
  await expect(menuItem).toBeVisible();
  await pressTabUntilFocused(page, menuItem);
  await page.keyboard.press("Enter");

  const cartRow = dialog.locator("tr[data-order-cart-item]").first();
  await expect(cartRow).toBeVisible();
  for (let index = 0; index < 6 && !await cartRow.evaluate((element) => document.activeElement === element); index += 1) {
    await page.keyboard.press("ArrowDown");
  }
  await expect(cartRow).toBeFocused();
  await page.keyboard.press("+");
  await expect(cartRow.locator("span.min-w-9")).toHaveText("2");

  // No request is made while focus moves or quantities change.
  expect(submissions).toBe(0);
  const createOrder = dialog.getByRole("button", { name: "Create Order", exact: true });
  await pressTabUntilFocused(page, createOrder, 30);
  await page.keyboard.press("Enter");
  await expect.poll(() => submissions).toBe(1);
});
