import assert from "node:assert/strict";
import test from "node:test";
import { printPaymentReceipt } from "./printPaymentReceipt.js";

test("payment receipt printing is isolated and only starts once", () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const classes = new Set(["kitchen-kot-printing"]);
  const listeners = new Map();
  let printCalls = 0;

  globalThis.document = {
    body: {
      classList: {
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
      },
    },
    getElementById: (id) => id === "payment-receipt-print" ? {} : null,
  };
  globalThis.window = {
    addEventListener: (name, listener) => listeners.set(name, listener),
    requestAnimationFrame: (callback) => callback(),
    print: () => { printCalls += 1; },
  };

  try {
    assert.equal(printPaymentReceipt(), true);
    assert.equal(printPaymentReceipt(), false);
    assert.equal(printCalls, 1);
    assert.equal(classes.has("payment-receipt-printing"), true);
    assert.equal(classes.has("kitchen-kot-printing"), false);

    listeners.get("afterprint")();
    assert.equal(classes.has("payment-receipt-printing"), false);

    assert.equal(printPaymentReceipt(), true);
    assert.equal(printCalls, 2);
    listeners.get("afterprint")();
  } finally {
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});
