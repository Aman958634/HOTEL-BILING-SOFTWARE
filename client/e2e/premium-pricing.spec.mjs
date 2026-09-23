import { expect, test } from "@playwright/test";

test("Premium pricing selector presents every term and carries the selected term to signup", async ({ page }) => {
  await page.route("**/api/v1/public/plans", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          trialDays: 5,
          plans: [
            { key: "basic", name: "Basic", price: 7500, currency: "INR", durationLabel: "3 months", monthlyEquivalentPrice: 2500, features: [], sortOrder: 1 },
            { key: "professional", name: "Pro", price: 15000, currency: "INR", durationLabel: "6 months", monthlyEquivalentPrice: 2500, features: [], sortOrder: 2 },
            {
              key: "enterprise", name: "Premium", price: 30000, currency: "INR", durationLabel: "1 year", monthlyEquivalentPrice: 2500, features: [], sortOrder: 3,
              premiumDurationOptions: [
                { years: 1, amount: 30000, durationLabel: "1 year" },
                { years: 2, amount: 60000, durationLabel: "2 years" },
                { years: 3, amount: 90000, durationLabel: "3 years" },
                { years: 4, amount: 120000, durationLabel: "4 years" },
                { years: 5, amount: 150000, durationLabel: "5 years" },
              ],
            },
          ],
        },
      }),
    });
  });

  await page.goto("/pricing");
  const premium = page.getByRole("heading", { name: "Premium" }).locator("xpath=../..");
  for (const [years, amount, label] of [
    [1, 30000, "1 year"],
    [2, 60000, "2 years"],
    [3, 90000, "3 years"],
    [4, 120000, "4 years"],
  ]) {
    await premium.getByRole("button", { name: `${years}Y` }).click();
    await expect(premium.getByText(new RegExp(`${amount.toLocaleString("en-IN")}\\s*/\\s*${label}`))).toBeVisible();
  }
  await premium.getByRole("button", { name: "5Y" }).click();
  await expect(premium.getByText("₹1,50,000 / 5 years")).toBeVisible();
  await expect(premium.getByText("Total payable: ₹1,50,000 · 5 years")).toBeVisible();
  await page.setViewportSize({ width: 320, height: 720 });
  await expect(premium.getByRole("button", { name: "5Y" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await premium.getByRole("button", { name: "Select Plan" }).click();
  await expect(page).toHaveURL(/\/subscribe\/register$/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("restosphere_selected_plan"))).toBe("enterprise");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("restosphere_selected_premium_duration_years"))).toBe("5");
});

test("checkout sends the persisted Premium term without a browser-controlled total", async ({ page }) => {
  const plans = [
    { key: "basic", name: "Basic", price: 7500, currency: "INR", durationLabel: "3 months", monthlyEquivalentPrice: 2500, features: [], sortOrder: 1 },
    { key: "professional", name: "Pro", price: 15000, currency: "INR", durationLabel: "6 months", monthlyEquivalentPrice: 2500, features: [], sortOrder: 2 },
    { key: "enterprise", name: "Premium", price: 30000, currency: "INR", durationLabel: "1 year", monthlyEquivalentPrice: 2500, features: [], sortOrder: 3, premiumDurationOptions: [
      { years: 1, amount: 30000, durationLabel: "1 year" }, { years: 2, amount: 60000, durationLabel: "2 years" }, { years: 3, amount: 90000, durationLabel: "3 years" }, { years: 4, amount: 120000, durationLabel: "4 years" }, { years: 5, amount: 150000, durationLabel: "5 years" },
    ] },
  ];
  let checkoutPayload = null;

  await page.route("**/api/v1/public/plans", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, data: { trialDays: 5, plans } }) }));
  await page.route("**/api/v1/admin/billing/subscription", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, data: { status: "expired", planName: "enterprise", metadata: { selectedPaidPlan: "enterprise", selectedPremiumDurationYears: 5 } } }) }));
  await page.route("**/api/v1/subscriptions/razorpay/create-order", async (route) => {
    checkoutPayload = JSON.parse(route.request().postData() || "{}");
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, data: { testMode: true, paymentId: "mock-premium-payment", amountRupees: 150000, currency: "INR" } }) });
  });
  await page.route("**/api/v1/admin/billing/verify", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, data: { status: "active", planName: "enterprise", price: 150000, durationLabel: "5 years" } }) }));

  await page.goto("/login");
  await page.getByLabel("Email address").fill("browser-admin@test.invalid");
  await page.getByRole("textbox", { name: "Password" }).fill("RoleMatrix@123");
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/admin/);

  await page.evaluate(() => {
    localStorage.setItem("restosphere_selected_plan", "enterprise");
    localStorage.setItem("restosphere_selected_premium_duration_years", "5");
  });
  await page.goto("/subscribe/checkout");
  await expect(page.getByText("Total payable: ₹1,50,000 / 5 years")).toBeVisible();
  await page.getByRole("button", { name: "Pay ₹1,50,000" }).click();
  await expect(page).toHaveURL(/\/subscribe\/success$/);
  expect(checkoutPayload).toEqual({ planId: "enterprise", premiumDurationYears: 5 });
});
