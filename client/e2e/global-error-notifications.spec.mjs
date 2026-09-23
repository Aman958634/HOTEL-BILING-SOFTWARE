import { expect, test } from "@playwright/test";

const expiredResponse = {
  success: false,
  code: "SUBSCRIPTION_EXPIRED",
  message: "Your free trial has ended.",
};

test("concurrent subscription failures open one gate without error toasts", async ({ page }) => {
  await page.route("**/api/v1/admin/billing/subscription", (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({ success: true, data: { status: "expired", planName: "enterprise" } }),
  }));
  for (const endpoint of ["stats", "sales", "recent-orders"]) {
    await page.route(`**/api/v1/admin/dashboard/${endpoint}**`, (route) => route.fulfill({
      status: 403,
      contentType: "application/json",
      body: JSON.stringify(expiredResponse),
    }));
  }

  await page.goto("/login");
  await page.getByLabel("Email address").fill("browser-admin@test.invalid");
  await page.getByRole("textbox", { name: "Password" }).fill("RoleMatrix@123");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/admin/);
  await expect(page.getByRole("heading", { name: "Your free trial has ended." })).toBeVisible();
  await expect.poll(() => page.locator('[role="status"]').filter({ hasText: "Your free trial has ended." }).count()).toBe(0);
});
