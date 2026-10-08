import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readSource = (name) => readFile(new URL(name, import.meta.url), "utf8");

test("Create New Order fetches every bounded table page when the modal opens", async () => {
  const [serviceSource, managementSource] = await Promise.all([
    readSource("../../../../services/tableService.js"),
    readSource("../../../../pages/admin/OrderManagement.jsx"),
  ]);

  assert.match(serviceSource, /getAllTablesForOrder/);
  assert.match(serviceSource, /totalPages/);
  assert.match(serviceSource, /Array\.from\(\{ length: totalPages - 1 \}/);
  assert.match(managementSource, /if \(!createOpen\) return;[\s\S]*void loadOrderTables\(\)/);
  assert.doesNotMatch(managementSource, /getTables\(\)/);
});

test("Create New Order no longer owns general special instructions", async () => {
  const [modalSource, draftSource] = await Promise.all([
    readSource("../CreateOrderModal.jsx"),
    readSource("../../../../utils/orderDraft.js"),
  ]);

  assert.doesNotMatch(modalSource, /special-instructions/);
  assert.doesNotMatch(modalSource, /specialInstructions/);
  assert.doesNotMatch(draftSource, /specialInstructions/);
});

test("table labels omit unavailable capacity and Kitchen stays in the admin route tree", async () => {
  const [detailsSource, routerSource] = await Promise.all([
    readSource("./OrderDetailsSection.jsx"),
    readSource("../../../../routes/AppRouter.jsx"),
  ]);

  assert.match(detailsSource, /Number\.isFinite\(capacity\) && capacity > 0/);
  assert.match(detailsSource, /tableOptionLabel\(table\)/);
  assert.match(routerSource, /<Route path="kitchen" element=\{<RoleRoute/);
  assert.doesNotMatch(routerSource, /path="\/dashboard\/admin\/kitchen"/);
});
test("Create New Order loads every tenant-scoped menu and category page, then filters by category id", async () => {
  const [menuServiceSource, categoryServiceSource, managementSource, itemsSource] = await Promise.all([
    readSource("../../../../services/menuService.js"),
    readSource("../../../../services/categoryService.js"),
    readSource("../../../../pages/admin/OrderManagement.jsx"),
    readSource("./ItemsSection.jsx"),
  ]);

  assert.match(menuServiceSource, /getAllAdminMenu/);
  assert.match(menuServiceSource, /totalPages/);
  assert.match(categoryServiceSource, /getAllAdminCategoriesForOrder/);
  assert.match(categoryServiceSource, /Array\.from\(\{ length: totalPages - 1 \}/);
  assert.match(managementSource, /getAllAdminMenu\(\{ available: true \}\)/);
  assert.match(managementSource, /getAllAdminCategoriesForOrder\(\)/);
  assert.match(itemsSource, /String\(categoryId\) === String\(menuCategory\)/);
  assert.match(itemsSource, /setMenuSearch\(""\)/);
  assert.match(itemsSource, /grid gap-2 sm:grid-cols-\[minmax\(0,1fr\)_180px\]/);
  assert.match(itemsSource, /<select aria-label="Filter by category"/);
  assert.match(itemsSource, /<option value="">All Categories<\/option>/);
  assert.match(itemsSource, /categories\.map\(\(category\) => <option/);
  assert.doesNotMatch(itemsSource, /const CategoryChips/);
});

test("Create New Order requires an explicit scoped draft decision", async () => {
  const [modalSource, draftSource] = await Promise.all([
    readSource("../CreateOrderModal.jsx"),
    readSource("../../../../utils/orderDraft.js"),
  ]);

  assert.match(modalSource, /Restore Draft/);
  assert.match(modalSource, /Start New Order/);
  assert.match(modalSource, /Confirm Start New Order/);
  assert.match(modalSource, /clearOrderDraft\(draftScope\)/);
  assert.match(modalSource, /activeOutletId \|\| localStorage\.getItem\("selectedOutletId"\)/);
  assert.doesNotMatch(modalSource, /toast\.success\("Unsent order restored/);
  assert.match(draftSource, /userId.*restaurantId.*outletId/s);
});

test("Create New Order separates retryable menu loading from table loading", async () => {
  const [managementSource, modalSource, itemsSource] = await Promise.all([
    readSource("../../../../pages/admin/OrderManagement.jsx"),
    readSource("../CreateOrderModal.jsx"),
    readSource("./ItemsSection.jsx"),
  ]);

  assert.match(managementSource, /dependencyInFlightRef/);
  assert.match(managementSource, /currentRequest\?\.scope === requestScope/);
  assert.match(managementSource, /ORDER_DEPENDENCY_TIMEOUT_MS = 30000/);
  assert.match(managementSource, /Menu loading timed out\. Please retry\./);
  assert.match(managementSource, /setDependenciesError\(error\?\.response\?\.data\?\.message \|\| error\?\.message/);
  assert.match(managementSource, /dependenciesLoading=\{dependenciesLoading\}/);
  assert.match(managementSource, /tablesLoading=\{tablesLoading\}/);
  assert.match(modalSource, /tablesLoading=\{tablesLoading\}/);
  assert.match(modalSource, /menuError=\{dependenciesError\}/);
  assert.match(itemsSource, /Array\.from\(\{ length: 6 \}/);
  assert.match(itemsSource, /Retry/);
});