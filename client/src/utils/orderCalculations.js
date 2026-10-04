const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export const normalizeGstRate = (value) => {
  const rate = Number(value);
  return Number.isFinite(rate) && rate >= 0 && rate <= 100 ? rate : 0;
};

/** Mirrors server/services/orderCalculationService.js for live UI totals. */
export const calculateOrderTotals = ({
  items = [],
  discount = 0,
  discountPercent,
  taxPercent = 0,
  serviceChargePercent = 0,
  deliveryCharge = 0,
  orderType = "DINE_IN",
}) => {
  let rawSubtotal = 0;
  let normalizedSubtotal = 0;
  let itemCount = 0;
  const normalizedItems = items.map((item) => {
    const quantity = Math.max(1, toNumber(item.quantity, 1));
    const price = Math.max(0, toNumber(item.price, 0));
    const lineSubtotal = round2(price * quantity);
    rawSubtotal += price * quantity;
    normalizedSubtotal += lineSubtotal;
    itemCount += quantity;
    return { ...item, quantity, price, subtotal: lineSubtotal, lineTotal: lineSubtotal };
  });

  const subtotal = round2(normalizedSubtotal);
  const requestedDiscount = discountPercent === undefined
    ? discount
    : round2((rawSubtotal * Math.max(0, Math.min(100, toNumber(discountPercent)))) / 100);
  let safeDiscount = Math.max(0, toNumber(requestedDiscount));
  safeDiscount = Math.min(safeDiscount, subtotal);

  const taxableBase = Math.max(0, subtotal - safeDiscount);
  // Preview only: the server resolves the authoritative restaurant GST rate.
  const tax = round2((taxableBase * normalizeGstRate(taxPercent)) / 100);
  const serviceCharge = round2((taxableBase * Math.max(0, toNumber(serviceChargePercent))) / 100);
  const resolvedDeliveryCharge =
    String(orderType).toUpperCase() === "DELIVERY" ? Math.max(0, toNumber(deliveryCharge)) : 0;

  const total = round2(Math.max(0, subtotal - safeDiscount + tax + serviceCharge + resolvedDeliveryCharge));

  return {
    items: normalizedItems,
    itemCount,
    subtotal,
    discount: round2(safeDiscount),
    tax,
    serviceCharge,
    deliveryCharge: round2(resolvedDeliveryCharge),
    total,
  };
};

export default calculateOrderTotals;
