const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
};

const sameObject = (left, right) => JSON.stringify(canonicalize(left || {})) === JSON.stringify(canonicalize(right || {}));

export const paymentUniqueIndexDefinitions = [
  { name: "payment_payment_id_unique", key: { paymentId: 1 }, options: { unique: true } },
  {
    name: "payment_transaction_id_unique",
    key: { transactionId: 1 },
    options: { unique: true, partialFilterExpression: { transactionId: { $type: "string", $gt: "" } } },
  },
  {
    name: "payment_razorpay_payment_id_unique",
    key: { razorpayPaymentId: 1 },
    options: { unique: true, partialFilterExpression: { razorpayPaymentId: { $type: "string", $gt: "" } } },
  },
  {
    name: "payment_order_idempotency_key_unique",
    key: { orderId: 1, idempotencyKey: 1 },
    options: { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string", $gt: "" } } },
  },
  {
    name: "payment_bill_idempotency_key_unique",
    key: { bill: 1, idempotencyKey: 1 },
    options: {
      unique: true,
      partialFilterExpression: { bill: { $type: "objectId" }, idempotencyKey: { $type: "string", $gt: "" } },
    },
  },
];

export const hasExactIndexKey = (index, key) => {
  const indexEntries = Object.entries(index?.key || {});
  const expectedEntries = Object.entries(key || {});
  return indexEntries.length === expectedEntries.length
    && expectedEntries.every(([field, direction]) => index?.key?.[field] === direction);
};

export const indexMatchesDefinition = (index, definition) =>
  index?.name === definition.name
  && index.unique === true
  && index.sparse !== true
  && hasExactIndexKey(index, definition.key)
  && sameObject(index.partialFilterExpression, definition.options.partialFilterExpression);

export const hasRequiredPaymentUniqueIndexes = (indexes) =>
  paymentUniqueIndexDefinitions.every((definition) => indexes.some((index) => indexMatchesDefinition(index, definition)));
