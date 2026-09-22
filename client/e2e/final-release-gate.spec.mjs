import { expect, test } from "@playwright/test";

const manager = { email: "browser-admin@test.invalid", password: "RoleMatrix@123" };
const kitchenManager = { email: "browser-kitchen-manager@test.invalid", password: "RoleMatrix@123" };
const superAdmin = { email: "browser-super-admin@test.invalid", password: "RoleMatrix@123" };
const statefulOrderTable = "13";
const validationTable = "14";
const billingTable = "15";

const login = async (page, user = manager) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(user.email);
  await page.getByRole("textbox", { name: "Password" }).fill(user.password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/admin/, { timeout: 15_000 });
};

const loginSuperAdmin = async (page) => {
  await page.goto("/super-admin-login");
  await page.getByLabel("Email address").fill(superAdmin.email);
  await page.getByRole("textbox", { name: "Password" }).fill(superAdmin.password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/\/super-admin\/dashboard/, { timeout: 15_000 });
};

const selectAvailableTable = async (dialog, tableNumber = statefulOrderTable) => {
  // The modal deliberately renders a loading placeholder until its dependencies
  // finish loading; target the actual native select rather than its label while
  // that placeholder is present.
  const tableSelect = dialog.locator("select#order-table");
  await expect(tableSelect).toBeVisible();
  const option = tableSelect.locator("option").filter({ hasText: new RegExp(`^Table ${tableNumber}\\b`) });
  await expect(option, `test fixture must expose exactly one available Table ${tableNumber}`).toHaveCount(1);
  const value = await option.getAttribute("value");
  expect(value, "test fixture must expose the available table").toBeTruthy();
  await tableSelect.selectOption(value);
  await expect(tableSelect).toHaveValue(value);
};

const billingCheckpoint = (stage) => console.log(`BILLING-E2E-${stage}`);

const sanitizeDiagnostic = (value) => String(value || "")
  .replace(/bearer\s+[^\s]+/gi, "Bearer [REDACTED]")
  .replace(/(authorization|token|password)=?[^\s&]+/gi, "$1=[REDACTED]")
  .slice(0, 240);

const attachBillingTrace = (page) => {
  const paymentUrl = (url) => new URL(url).pathname.startsWith("/api/v1/payments/") || new URL(url).pathname.includes("/api/v1/orders/");
  page.on("request", (request) => {
    if (paymentUrl(request.url())) console.log(`BILLING-NET-START ${request.method()} ${new URL(request.url()).pathname}`);
  });
  page.on("response", (response) => {
    if (paymentUrl(response.url())) console.log(`BILLING-NET-RESPONSE ${response.status()} ${new URL(response.url()).pathname}`);
  });
  page.on("requestfailed", (request) => {
    if (paymentUrl(request.url())) console.log(`BILLING-NET-FAILED ${request.method()} ${new URL(request.url()).pathname}`);
  });
  page.on("pageerror", (error) => console.log(`BILLING-PAGE-ERROR ${error.name}`));
  page.on("console", (message) => {
    if (message.type() === "error") console.log(`BILLING-CONSOLE-ERROR ${sanitizeDiagnostic(message.text())}`);
  });
};

test("registration validates inline and creates an isolated account", async ({ page }) => {
  const email = `browser-registration-e2e-${Date.now()}@test.invalid`;
  await page.goto("/register");
  await page.getByRole("button", { name: "Create Account", exact: true }).click();
  await expect(page.getByText("Full name is required")).toBeVisible();
  await page.getByLabel("Full Name").fill("Browser Registration");
  await page.getByLabel("Email Address").fill(email);
  await page.getByLabel("Phone Number").fill("9876543210");
  await page.getByRole("textbox", { name: "Password", exact: true }).fill("BrowserPass@123");
  await page.getByRole("textbox", { name: "Confirm Password" }).fill("BrowserPass@123");
  const registrationResponse = page.waitForResponse((response) =>
    response.request().method() === "POST" && /\/api\/v1\/auth\/register$/.test(response.url())
  );
  await page.getByRole("button", { name: "Create Account", exact: true }).click();
  const registrationHttpResponse = await registrationResponse;
  expect(registrationHttpResponse.status(), "registration must be accepted by the API").toBe(201);
  const registrationPayload = await registrationHttpResponse.json();
  expect(registrationPayload.success, "registration response must confirm success").toBe(true);
  expect(registrationPayload.data?.email, "the unique test account must be created").toBe(email);
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByLabel("Email address")).toHaveValue(email);
});

test("super admin restaurant details and edit route remain compatible", async ({ page }) => {
  await loginSuperAdmin(page);
  const listResponse = page.waitForResponse((response) =>
    response.request().method() === "GET" && /\/api\/v1\/super-admin\/restaurants(?:\?|$)/.test(response.url())
  );
  await page.goto("/super-admin/restaurants");
  const response = await listResponse;
  expect(response.status(), "super admin restaurant list must succeed").toBe(200);
  const payload = await response.json();
  expect((payload.data?.items || []).some((entry) => entry.name === "Browser Role Matrix Restaurant"), "fixture restaurant must be returned by the API").toBeTruthy();
  const restaurantRow = page.locator("tr").filter({ hasText: "Browser Role Matrix Restaurant" }).first();
  await expect(restaurantRow).toBeVisible();
  await restaurantRow.getByRole("link", { name: "Details", exact: true }).click();
  await expect(page).toHaveURL(/\/super-admin\/restaurants\/[a-f\d]{24}$/i);
  const restaurantId = page.url().split("/").pop();
  await expect(page.getByRole("heading", { name: "Browser Role Matrix Restaurant" })).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/super-admin/restaurants/${restaurantId}/edit$`));
  await expect(page.getByRole("heading", { name: "Edit Restaurant" })).toBeVisible();
  await page.getByLabel("Restaurant name").fill("Browser Role Matrix Restaurant");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/super-admin/restaurants/${restaurantId}$`));
});

test("order/KDS: browser-created ticket is visible and completes", async ({ page }) => {
  await login(page);
  await page.goto("/dashboard/admin/orders");
  await page.getByRole("button", { name: "Create Order", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await selectAvailableTable(dialog);
  await dialog.getByRole("button", { name: /Paneer Tikka/ }).click();
  await expect(dialog.getByText("Paneer Tikka").last()).toBeVisible();
  const createResponse = page.waitForResponse((response) => /\/api\/v1\/orders\/?$/.test(response.url()) && response.request().method() === "POST");
  await dialog.getByRole("button", { name: "Create Order", exact: true }).click();
  const createdHttpResponse = await createResponse;
  expect(createdHttpResponse.status(), "browser order creation must succeed").toBe(201);
  const createdOrder = (await createdHttpResponse.json()).data;
  expect(createdOrder.restaurant).toBeTruthy();
  expect(createdOrder.outlet).toBeTruthy();
  await expect(page.getByRole("dialog", { name: /Order ID:/ })).toBeVisible();
  await expect(page.getByText("Grand Total")).toBeVisible();
  await page.getByRole("button", { name: "Pay Later", exact: true }).click();
  await expect(page.getByText(createdOrder.orderNumber).first()).toBeVisible();

  let kdsRequest = null;
  page.on("request", (request) => {
    if (request.method() === "GET" && /\/api\/v1\/kitchen\/tickets(?:\?|$)/.test(request.url())) {
      kdsRequest = {
        url: request.url(),
        outletId: request.headers()["x-outlet-id"] || null,
      };
    }
  });
  const kdsResponsePromise = page.waitForResponse((response) =>
    response.request().method() === "GET" &&
    /\/api\/v1\/kitchen\/tickets(?:\?|$)/.test(response.url())
  );
  await page.goto("/dashboard/admin/kitchen");
  const kdsResponse = await kdsResponsePromise;
  expect([200, 304], "KDS must return data or a valid cache revalidation").toContain(kdsResponse.status());
  console.log(`KDS-NET-RESPONSE ${kdsResponse.status()} /api/v1/kitchen/tickets`);
  const kdsPayload = kdsResponse.status() === 200 ? await kdsResponse.json() : null;
  const returnedTicket = (kdsPayload?.data || []).find((entry) => String(entry.orderId) === String(createdOrder._id));
  expect(kdsRequest?.outletId, "KDS must request the selected outlet").toBe(String(createdOrder.outlet));
  if (kdsResponse.status() === 200) expect(returnedTicket, "KDS endpoint must return the newly created ticket").toBeTruthy();
  const ticket = page.locator("article").filter({ hasText: createdOrder.orderNumber });
  await expect(ticket).toBeVisible();
  // A ticket exposes both item-level and bulk actions. The lifecycle gate
  // intentionally exercises the bulk action used by the board workflow.
  const startResponse = page.waitForResponse((response) => response.url().includes(`/kitchen/tickets/${createdOrder._id}/start`) && response.status() === 200);
  await ticket.getByRole("button", { name: "Start", exact: true }).last().click();
  expect((await (await startResponse).json()).data.kitchenPhase).toBe("PREPARING");
  await expect(ticket.getByRole("button", { name: "Mark Ready", exact: true })).toBeVisible();
  const readyResponse = page.waitForResponse((response) => response.url().includes(`/kitchen/tickets/${createdOrder._id}/ready`) && response.status() === 200);
  await ticket.getByRole("button", { name: "Mark Ready", exact: true }).click();
  expect((await (await readyResponse).json()).data.kitchenPhase).toBe("READY");
  await expect(ticket.getByRole("button", { name: "Complete", exact: true })).toBeVisible();
  const completeResponse = page.waitForResponse((response) => response.url().includes(`/kitchen/tickets/${createdOrder._id}/serve`) && response.status() === 200);
  await ticket.getByRole("button", { name: "Complete", exact: true }).click();
  expect((await (await completeResponse).json()).data.kitchenPhase).toBe("COMPLETED");
  await expect(ticket.getByText("Served", { exact: true })).toBeVisible();

});

test("billing/payment: a browser-created order is paid by safe cash UI", async ({ page }) => {
  attachBillingTrace(page);
  await login(page);
  billingCheckpoint("01 login complete");
  billingCheckpoint("02 outlet context selected");
  const tablesResponse = page.waitForResponse((response) =>
    response.request().method() === "GET" && /\/api\/v1\/tables(?:\?|$)/.test(response.url())
  );
  await page.goto("/dashboard/admin/orders");
  const tablesHttpResponse = await tablesResponse;
  expect(tablesHttpResponse.status(), "billing table request must succeed").toBe(200);
  const tablesPayload = await tablesHttpResponse.json();
  expect(
    (tablesPayload.data || []).some((table) => table.tableNumber === billingTable && table.status === "AVAILABLE"),
    "the active outlet must expose the dedicated available billing table fixture"
  ).toBeTruthy();
  await page.getByRole("button", { name: "Create Order", exact: true }).click();
  const createDialog = page.getByRole("dialog");
  await expect(createDialog).toBeVisible();
  await selectAvailableTable(createDialog, billingTable);
  billingCheckpoint("03 table selected");
  await createDialog.getByRole("button", { name: /Paneer Tikka/ }).click();
  const createResponse = page.waitForResponse((response) => /\/api\/v1\/orders\/?$/.test(response.url()) && response.request().method() === "POST");
  await createDialog.getByRole("button", { name: "Create Order", exact: true }).click();
  const createdHttpResponse = await createResponse;
  expect(createdHttpResponse.status(), "browser order creation must succeed").toBe(201);
  const order = (await createdHttpResponse.json()).data;
  billingCheckpoint("04 order created");
  await page.getByRole("button", { name: "Pay Later", exact: true }).click();
  const orderRow = page.getByRole("row", { name: new RegExp(order.orderNumber) });
  await expect(orderRow.getByText(/₹|â‚¹/)).toBeVisible();
  billingCheckpoint("05 order persisted");
  billingCheckpoint("06 billing page opened");
  const summaryResponse = page.waitForResponse((response) => response.url().includes(`/payments/order/${order._id}/summary`) && response.request().method() === "GET");
  billingCheckpoint("07 payment summary request started");
  await orderRow.getByRole("button", { name: "Retry Payment", exact: true }).click();
  expect((await summaryResponse).status(), "payment summary must load for the selected order").toBe(200);
  billingCheckpoint("08 payment summary response received");
  const paymentDialog = page.getByRole("dialog", { name: new RegExp(`Order #${order.orderNumber}`) });
  await expect(paymentDialog).toBeVisible({ timeout: 15_000 });
  billingCheckpoint("09 payment modal opened");
  await paymentDialog.getByRole("button", { name: "Cash", exact: true }).click();
  billingCheckpoint("10 cash selected");
  const paymentResponse = page.waitForResponse((response) => response.url().includes(`/orders/${order._id}/pay`) && response.request().method() === "POST");
  billingCheckpoint("11 payment request started");
  await paymentDialog.getByRole("button", { name: /^Pay / }).click();
  const paymentHttpResponse = await paymentResponse;
  expect(paymentHttpResponse.status(), "safe cash payment must succeed").toBe(200);
  billingCheckpoint("12 payment response received");
  await expect(page.getByText(/Payment successful/)).toBeVisible();
  billingCheckpoint("13 success UI rendered");
  await expect(orderRow.getByText(/PAID/i)).toBeVisible();
  await expect(orderRow.getByRole("button", { name: "Retry Payment", exact: true })).toHaveCount(0);
  billingCheckpoint("14 persisted payment verified");
});

test("403: restricted table content is not rendered", async ({ page }) => {
  await login(page, kitchenManager);
  await page.goto("/dashboard/admin/tables");
  await expect(page.getByRole("alert").getByText("You do not have permission to manage tables.", { exact: true })).toBeVisible();
});

test("429: table rate-limit response renders safe feedback", async ({ page }) => {
  await login(page);
  await page.route("**/api/v1/tables**", (route) => route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ success: false, message: "Too many requests" }) }));
  await page.goto("/dashboard/admin/tables");
  await expect(page.getByRole("alert").getByText("Too many requests", { exact: true })).toBeVisible();
  await page.unroute("**/api/v1/tables**");
});

test("network failure: table UI renders an error and recovers on retry", async ({ page }) => {
  await login(page);
  await page.route("**/api/v1/tables**", (route) => route.abort("failed"));
  await page.goto("/dashboard/admin/tables");
  await expect(page.getByRole("alert").getByText(/Unable to load tables/i)).toBeVisible();
  await page.unroute("**/api/v1/tables**");
  await page.getByRole("button", { name: /Retry/ }).click();
  await expect(page.getByText(/Table/i).first()).toBeVisible();
});

test("401: expired-session response returns to login without exposing protected data", async ({ page }) => {
  await login(page);
  let tableRequests = 0;
  let refreshRequests = 0;
  await page.route("**/api/v1/tables**", (route) => {
    tableRequests += 1;
    return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ success: false, message: "Unauthorized" }) });
  });
  await page.route("**/api/v1/auth/refresh", (route) => {
    refreshRequests += 1;
    return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ success: false, message: "Unauthorized" }) });
  });
  const protectedResponse = page.waitForResponse((response) =>
    response.request().method() === "GET" && /\/api\/v1\/tables(?:\?|$)/.test(response.url()) && response.status() === 401
  );
  const refreshResponse = page.waitForResponse((response) =>
    response.request().method() === "POST" && /\/api\/v1\/auth\/refresh$/.test(response.url()) && response.status() === 401
  );
  await page.goto("/dashboard/admin/tables");
  await Promise.all([protectedResponse, refreshResponse]);
  expect(tableRequests, "the protected tables request must be intercepted").toBeGreaterThan(0);
  expect(refreshRequests, "a real expired-session test must make refresh fail too").toBe(1);
  await expect(page).toHaveURL(/\/login/);
  await expect.poll(() => page.evaluate(() => ({ accessToken: localStorage.getItem("accessToken"), refreshToken: localStorage.getItem("refreshToken") }))).toEqual({ accessToken: null, refreshToken: null });
});

test("422 order validation response is presented without a blank screen", async ({ page }) => {
  await login(page);
  const tablesResponse = page.waitForResponse((response) =>
    response.request().method() === "GET" && /\/api\/v1\/tables(?:\?|$)/.test(response.url())
  );
  await page.goto("/dashboard/admin/orders");
  const tablesHttpResponse = await tablesResponse;
  expect(tablesHttpResponse.status(), "fixture tables request must succeed").toBe(200);
  const tablesPayload = await tablesHttpResponse.json();
  expect(
    (tablesPayload.data || []).some((table) => table.tableNumber === validationTable && table.status === "AVAILABLE"),
    "the active outlet must expose the dedicated available validation table fixture"
  ).toBeTruthy();
  await page.getByRole("button", { name: "Create Order", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await selectAvailableTable(dialog, validationTable);
  await dialog.getByRole("button", { name: /Masala Dosa/ }).click();
  await expect(dialog.locator("tbody").getByText("Masala Dosa", { exact: true })).toBeVisible();
  const submitButton = dialog.getByRole("button", { name: "Create Order", exact: true });
  await expect(submitButton).toBeEnabled();
  let submittedOrder = null;
  await page.route((url) => /\/api\/v1\/orders\/?$/.test(url.href), (route) => route.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify({ success: false, message: "Order validation failed" }) }));
  const orderRequest = page.waitForRequest((request) => /\/api\/v1\/orders\/?$/.test(request.url()) && request.method() === "POST");
  const validationResponse = page.waitForResponse((response) => /\/api\/v1\/orders\/?$/.test(response.url()) && response.request().method() === "POST");
  await submitButton.click();
  submittedOrder = JSON.parse((await orderRequest).postData() || "{}");
  expect(submittedOrder.table, "the valid selected table must reach the API").toBe(await dialog.getByLabel("Table").inputValue());
  expect(submittedOrder.items, "the selected menu item must reach the API").toHaveLength(1);
  expect(submittedOrder.items[0].name).toBe("Masala Dosa");
  expect((await validationResponse).status(), "the simulated validation request must remain a 422").toBe(422);
  await expect(page.getByText("Order validation failed", { exact: true }).first()).toBeVisible();
  await expect(dialog).toBeVisible();
});
