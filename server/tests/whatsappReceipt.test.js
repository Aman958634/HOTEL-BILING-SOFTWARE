import assert from "node:assert/strict";
import Payment from "../models/Payment.js";
import Order from "../models/Order.js";
import Restaurant from "../models/Restaurant.js";
import {
  assertWhatsAppConfiguration,
  getWhatsAppConfig,
  normalizeWhatsAppPhone,
  sendPaymentReceiptWhatsApp,
  triggerSuccessfulPaymentSideEffects,
} from "../services/whatsappService.js";

const keys = [
  "WHATSAPP_ENABLED",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_API_VERSION",
  "WHATSAPP_RECEIPT_TEMPLATE_NAME",
  "WHATSAPP_DEFAULT_COUNTRY_CODE",
];
const originalEnvironment = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
const originalFetch = globalThis.fetch;
const originalMethods = {
  findOneAndUpdate: Payment.findOneAndUpdate,
  findById: Payment.findById,
  updateOne: Payment.updateOne,
  findOrderById: Order.findById,
  findRestaurantById: Restaurant.findById,
};

const finalOrder = {
  _id: "order-id",
  orderNumber: "ORD-1001",
  paymentStatus: "PAID",
  customer: { fullName: "Aman", phone: "9876543210" },
  items: [{ name: "Coffee", quantity: 1, price: 100, subtotal: 100 }],
  total: 100,
  subtotal: 100,
};
const finalPayment = {
  _id: "payment-id",
  orderId: "order-id",
  restaurant: "restaurant-id",
  outlet: "outlet-id",
  paymentId: "PAY-1001",
  paymentStatus: "PAID",
  paymentMethod: "UPI",
  amount: 100,
  totalAmount: 100,
  metadata: {},
};

try {
  process.env.WHATSAPP_ENABLED = "false";
  delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  delete process.env.WHATSAPP_ACCESS_TOKEN;
  delete process.env.WHATSAPP_RECEIPT_TEMPLATE_NAME;

  assert.equal(normalizeWhatsAppPhone("9876543210"), "919876543210");
  assert.equal(normalizeWhatsAppPhone("+919876543210"), "919876543210");
  assert.equal(normalizeWhatsAppPhone("919876543210"), "919876543210");
  assert.equal(normalizeWhatsAppPhone("123"), "");
  assert.equal(getWhatsAppConfig().enabled, false);
  assert.deepEqual(await sendPaymentReceiptWhatsApp({ paymentId: "unused", automatic: true }), { skipped: true, reason: "WHATSAPP_DISABLED" });

  process.env.WHATSAPP_ENABLED = "true";
  assert.throws(() => assertWhatsAppConfiguration(), /configuration is incomplete/i);

  process.env.WHATSAPP_PHONE_NUMBER_ID = "phone-number-id";
  process.env.WHATSAPP_ACCESS_TOKEN = "test-token";
  process.env.WHATSAPP_API_VERSION = "v22.0";
  process.env.WHATSAPP_RECEIPT_TEMPLATE_NAME = "payment_receipt";
  assert.doesNotThrow(() => assertWhatsAppConfiguration());

  const claims = [];
  const updates = [];
  const requests = [];
  Payment.findOneAndUpdate = async (filter, update) => {
    claims.push({ filter, update });
    return finalPayment;
  };
  Payment.findById = async () => finalPayment;
  Payment.updateOne = async (filter, update) => {
    updates.push({ filter, update });
    return { acknowledged: true };
  };
  const orderQuery = {
    populate() { return this; },
    then(resolve, reject) { return Promise.resolve(finalOrder).then(resolve, reject); },
  };
  Order.findById = () => orderQuery;
  Restaurant.findById = () => ({ lean: async () => ({ _id: "restaurant-id", name: "RestoSphere Test" }) });
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return {
      ok: true,
      json: async () => (String(url).endsWith("/media") ? { id: "media-id" } : { messages: [{ id: "wamid-123" }] }),
    };
  };

  const delivered = await sendPaymentReceiptWhatsApp({ paymentId: "payment-id", automatic: true });
  assert.deepEqual(delivered, { sent: true, messageId: "wamid-123" });
  assert.equal(claims.length, 1);
  assert.equal(claims[0].filter.paymentStatus, "PAID");
  assert.equal(claims[0].filter.$and.length, 3);
  assert.equal(claims[0].update.$set["whatsappReceipt.automaticSent"], true);
  assert.equal(requests.length, 2);
  assert.match(requests[0].url, /\/media$/);
  assert.match(requests[1].url, /\/messages$/);
  const messagePayload = JSON.parse(requests[1].options.body);
  assert.equal(messagePayload.to, "919876543210");
  assert.equal(messagePayload.template.name, "payment_receipt");
  assert.equal(messagePayload.template.components[0].parameters[0].document.id, "media-id");
  assert.equal(updates.at(-1).update.$set["whatsappReceipt.status"], "SENT");

  Payment.findOneAndUpdate = async () => null;
  globalThis.fetch = async () => assert.fail("Duplicate automatic webhook must not call Meta");
  assert.deepEqual(await sendPaymentReceiptWhatsApp({ paymentId: "payment-id", automatic: true }), { skipped: true, reason: "ALREADY_SENT_OR_IN_PROGRESS" });
  assert.deepEqual(await triggerSuccessfulPaymentSideEffects({ order: { paymentStatus: "PENDING" }, payment: finalPayment, fullyPaid: false }), { skipped: true, reason: "NOT_FINAL_PAID" });

  Payment.findOneAndUpdate = async () => finalPayment;
  globalThis.fetch = async () => ({ ok: false, status: 400, json: async () => ({ error: { code: 190, message: "Template rejected" } }) });
  await assert.rejects(() => sendPaymentReceiptWhatsApp({ paymentId: "payment-id", automatic: false }), /rejected/i);
  assert.equal(updates.at(-1).update.$set["whatsappReceipt.status"], "FAILED");
  assert.equal(updates.every(({ update }) => !Object.hasOwn(update.$set || {}, "paymentStatus")), true);

  console.log("whatsappReceipt.test.js passed");
} finally {
  globalThis.fetch = originalFetch;
  Payment.findOneAndUpdate = originalMethods.findOneAndUpdate;
  Payment.findById = originalMethods.findById;
  Payment.updateOne = originalMethods.updateOne;
  Order.findById = originalMethods.findOrderById;
  Restaurant.findById = originalMethods.findRestaurantById;
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}