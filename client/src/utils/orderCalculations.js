const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

/** Mirrors server/services/orderCalculationService.js for live UI totals. */
export const calculateOrderTotals = ({
  items = [],
  discount = 0,
  taxPercent = 0,
  serviceChargePercent = 0,
  deliveryCharge = 0,
  orderType = "DINE_IN",
}) => {
  const normalizedItems = items.map((item) => {
    const quantity = Math.max(1, toNumber(item.quantity, 1));
    const price = Math.max(0, toNumber(item.price, 0));
    const subtotal = round2(price * quantity);
    return { ...item, quantity, price, subtotal, lineTotal: subtotal };
  });

  const subtotal = round2(normalizedItems.reduce((sum, item) => sum + item.subtotal, 0));
  let safeDiscount = Math.max(0, toNumber(discount));
  safeDiscount = Math.min(safeDiscount, subtotal);

  const taxableBase = Math.max(0, subtotal - safeDiscount);
  const tax = round2((taxableBase * Math.max(0, toNumber(taxPercent))) / 100);
  const serviceCharge = round2((taxableBase * Math.max(0, toNumber(serviceChargePercent))) / 100);
  const resolvedDeliveryCharge =
    String(orderType).toUpperCase() === "DELIVERY" ? Math.max(0, toNumber(deliveryCharge)) : 0;

  const total = round2(Math.max(0, subtotal - safeDiscount + tax + serviceCharge + resolvedDeliveryCharge));

  return {
    items: normalizedItems,
    subtotal,
    discount: round2(safeDiscount),
    tax,
    serviceCharge,
    deliveryCharge: round2(resolvedDeliveryCharge),
    total,
  };
};

export default calculateOrderTotals;
