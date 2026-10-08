import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { getShortcutKey, isEditableTarget } from "./keyboardShortcuts.js";

test("normalizes only the approved POS keyboard shortcuts", () => {
  assert.equal(getShortcutKey({ key: "F6" }), "f6");
  assert.equal(getShortcutKey({ key: "Enter", ctrlKey: true }), "ctrl+enter");
  assert.equal(getShortcutKey({ key: "k", metaKey: true }), "ctrl+k");
  assert.equal(getShortcutKey({ key: "+" }), "plus");
  assert.equal(getShortcutKey({ key: "a" }), "");
});

test("protects standard editable controls from non-explicit shortcuts", () => {
  assert.equal(isEditableTarget({ tagName: "INPUT" }), true);
  assert.equal(isEditableTarget({ tagName: "textarea" }), true);
  assert.equal(isEditableTarget({ tagName: "select" }), true);
  assert.equal(isEditableTarget({ isContentEditable: true }), true);
  assert.equal(isEditableTarget({ tagName: "button" }), false);
});

test("POS actions use the central shortcut scope and retain payment safeguards", async () => {
  const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
  const [provider, orderManagement, createModal, itemsSection, globalSearch] = await Promise.all([
    read("./KeyboardShortcutContext.jsx"),
    read("../pages/admin/OrderManagement.jsx"),
    read("../components/admin/orders/CreateOrderModal.jsx"),
    read("../components/admin/orders/create/ItemsSection.jsx"),
    read("../components/common/GlobalSearch.jsx"),
  ]);

  assert.match(provider, /document\.addEventListener\("keydown", onKeyDown, true\)/);
  assert.match(createModal, /f3:[\s\S]*tableSelectRef\.current\?\.focus/);
  assert.match(createModal, /f4:[\s\S]*orderType: "TAKEAWAY"/);
  assert.match(createModal, /"ctrl\+enter"/);
  assert.match(itemsSection, /f5:/);
  assert.match(itemsSection, /f6:/);
  assert.match(itemsSection, /arrowdown:/);
  assert.match(itemsSection, /plus:/);
  assert.match(itemsSection, /delete:/);
  assert.match(orderManagement, /f2:/);
  assert.match(orderManagement, /f7:/);
  assert.match(orderManagement, /f8:[\s\S]*openRetryPayment\(operationalShortcutOrder\)/);
  assert.match(orderManagement, /PaymentReceipt from "\.\.\/\.\.\/components\/payments\/PaymentReceipt"/);
  assert.match(orderManagement, /getOrderPaymentSummary\(order\._id\)[\s\S]*filter\(canViewPaymentReceipt\)/);
  assert.match(orderManagement, /No payment receipt available for this order\./);
  assert.match(orderManagement, /multiple verified payments/);
  assert.match(orderManagement, /f9:[\s\S]*void openReceipt\(selectedOrder\)/);
  assert.match(orderManagement, /f9:[\s\S]*hasOpenOrderDialog/);
  assert.doesNotMatch(globalSearch, /document\.addEventListener\("keydown", onShortcut/);
  assert.doesNotMatch(globalSearch, /document\.addEventListener\("keydown", onEscape/);
});
test("F9 receipt selection is explicit and does not reuse the Order Details drawer", async () => {
  const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
  const [orderManagement, orderTable, orderCard] = await Promise.all([
    read("../pages/admin/OrderManagement.jsx"),
    read("../components/admin/orders/OrderTable.jsx"),
    read("../components/admin/orders/OrderCard.jsx"),
  ]);

  assert.match(orderManagement, /selectedOrderId=\{selectedOrder\?\._id\}/);
  assert.match(orderManagement, /onSelect=\{setSelectedOrder\}/);
  assert.match(orderManagement, /f9:[\s\S]*if \(!selectedOrder \|\| hasOpenOrderDialog\) return false/);
  assert.match(orderManagement, /setReceiptOpen\(true\)/);
  assert.doesNotMatch(orderManagement, /f9:[\s\S]{0,300}setDetailsOpen\(true\)/);
  assert.match(orderTable, /selectedOrderId, onSelect/);
  assert.match(orderCard, /onClick=\{\(\) => onSelect\?\.\(order\)\}/);
});