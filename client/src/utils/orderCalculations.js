import { fromPaise, multiplyPaise, percentageOfPaise, toPaise } from "./money";

const safeRate = (value) => {
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
  let itemCount = 0;
  const normalizedItems = items.map((item) => {
    const quantity = Math.max(1, Number(item.quantity) || 1);
    const pricePaise = Math.max(0, toPaise(item.price));
    const linePaise = multiplyPaise(pricePaise, quantity);
    itemCount += quantity;
    return { ...item, quantity, price: fromPaise(pricePaise), subtotal: fromPaise(linePaise), lineTotal: fromPaise(linePaise) };
  });
  const subtotalPaise = normalizedItems.reduce((sum, item) => sum + toPaise(item.subtotal), 0);
  const requestedDiscountPaise = discountPercent === undefined
    ? toPaise(discount)
    : percentageOfPaise(subtotalPaise, Math.max(0, Math.min(100, safeRate(discountPercent))));
  const discountPaise = Math.min(Math.max(requestedDiscountPaise, 0), subtotalPaise);
  const taxablePaise = subtotalPaise - discountPaise;
  const taxPaise = percentageOfPaise(taxablePaise, safeRate(taxPercent));
  const servicePaise = percentageOfPaise(taxablePaise, Math.max(0, safeRate(serviceChargePercent)));
  const deliveryPaise = String(orderType).toUpperCase() === "DELIVERY" ? Math.max(0, toPaise(deliveryCharge)) : 0;
  const totalPaise = Math.max(0, subtotalPaise - discountPaise + taxPaise + servicePaise + deliveryPaise);

  return {
    items: normalizedItems, itemCount, subtotal: fromPaise(subtotalPaise), discount: fromPaise(discountPaise),
    tax: fromPaise(taxPaise), serviceCharge: fromPaise(servicePaise), deliveryCharge: fromPaise(deliveryPaise), total: fromPaise(totalPaise),
  };
};

export const normalizeGstRate = safeRate;
export default calculateOrderTotals;
