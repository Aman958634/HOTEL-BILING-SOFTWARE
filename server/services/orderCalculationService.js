import ApiError from "../utils/ApiError.js";

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

export const calculateOrderAmounts = ({
  items,
  discount = 0,
  tax = null,
  taxPercent = 18,
  serviceCharge = null,
  serviceChargePercent = 0,
  deliveryCharge = 0,
  orderType = "DINE_IN",
}) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(422, "An order must contain at least one item.");
  }

  const normalizedItems = items.map((item) => {
    const quantity = toNumber(item.quantity, 0);
    const price = toNumber(item.price, 0);

    if (quantity <= 0) {
      throw new ApiError(422, "Item quantity must be greater than 0.");
    }

    if (price < 0) {
      throw new ApiError(422, "Item price cannot be negative.");
    }

    const subtotal = round2(price * quantity);

    return {
      ...item,
      quantity,
      price,
      subtotal,
    };
  });

  const subtotal = round2(normalizedItems.reduce((sum, item) => sum + item.subtotal, 0));

  let safeDiscount = Math.max(0, toNumber(discount));
  safeDiscount = Math.min(safeDiscount, subtotal);

  const taxableBase = Math.max(0, subtotal - safeDiscount);

  // POS bills are GST-inclusive only through this calculation path. The
  // configured/legacy input cannot lower the statutory 18% tax below GST.
  const resolvedTax = round2((taxableBase * Math.max(18, toNumber(taxPercent, 18))) / 100);

  const resolvedServiceCharge = serviceCharge !== null && serviceCharge !== undefined
    ? Math.max(0, toNumber(serviceCharge))
    : round2((taxableBase * Math.max(0, toNumber(serviceChargePercent))) / 100);

  const resolvedDeliveryCharge = String(orderType).toUpperCase() === "DELIVERY"
    ? Math.max(0, toNumber(deliveryCharge))
    : 0;

  const total = round2(
    Math.max(0, subtotal - safeDiscount + resolvedTax + resolvedServiceCharge + resolvedDeliveryCharge)
  );

  return {
    items: normalizedItems,
    subtotal,
    discount: round2(safeDiscount),
    tax: round2(resolvedTax),
    serviceCharge: round2(resolvedServiceCharge),
    deliveryCharge: round2(resolvedDeliveryCharge),
    total,
  };
};
