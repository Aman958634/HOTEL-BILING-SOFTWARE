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
  assert.match(itemsSource, /whitespace-normal break-words/);
  assert.match(itemsSource, /max-h-64 w-full overflow-y-auto/);
});
