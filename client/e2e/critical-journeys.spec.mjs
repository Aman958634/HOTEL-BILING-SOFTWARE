import { expect, test } from "@playwright/test";

const manager = { email: "browser-manager@test.invalid", password: "RoleMatrix@123" };

const assertNoCriticalBrowserErrors = (page) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return () => expect(errors, errors.join("\n")).toEqual([]);
};

const login = async (page) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(manager.email);
  await page.getByRole("textbox", { name: "Password" }).fill(manager.password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/admin/);
};

test("protected routes, login, dashboard, tables, orders, KDS and logout", async ({ page }) => {
  const assertNoErrors = assertNoCriticalBrowserErrors(page);

  await page.goto("/dashboard/admin/tables");
  await expect(page).toHaveURL(/\/login/);

  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page.getByText("Email address is required.")).toBeVisible();

  await login(page);
  await expect(page.locator("body")).not.toBeEmpty();
  await expect(page.getByText(/dashboard|overview/i).first()).toBeVisible();

  await page.goto("/dashboard/admin/tables");
  await expect(page.locator("body")).not.toBeEmpty();
  await expect(page.getByText(/table/i).first()).toBeVisible();

  await page.goto("/dashboard/admin/orders");
  await expect(page.locator("body")).not.toBeEmpty();
  await expect(page.getByText(/order/i).first()).toBeVisible();

  await page.goto("/dashboard/admin/kitchen");
  await expect(page.locator("body")).not.toBeEmpty();
  await expect(page.getByText(/kitchen|KDS/i).first()).toBeVisible();

  const logout = page.getByRole("button", { name: /logout|sign out/i }).first();
  await expect(logout).toBeVisible();
  await logout.click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: "Login", exact: true }).first()).toBeVisible();
  assertNoErrors();
});

test("public menu/QR route renders without authentication", async ({ page }) => {
  const assertNoErrors = assertNoCriticalBrowserErrors(page);
  await page.goto("/menu/browser-role-matrix-fixture");
  await expect(page.getByText("Paneer Tikka")).toBeVisible();
  await expect(page.getByText("Masala Dosa")).toBeVisible();
  assertNoErrors();
});

test("not-found route presents a UI instead of a blank screen", async ({ page }) => {
  const assertNoErrors = assertNoCriticalBrowserErrors(page);
  await page.goto("/not-a-real-restosphere-route");
  await expect(page.locator("body")).not.toBeEmpty();
  await expect(page.getByText(/not found|404/i).first()).toBeVisible();
  assertNoErrors();
});
