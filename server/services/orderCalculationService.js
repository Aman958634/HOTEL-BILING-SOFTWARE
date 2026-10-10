import ApiError from "../utils/ApiError.js";
import { normalizeGstRate } from "./gstService.js";
import { clampPaise, fromPaise, multiplyPaise, percentageOfPaise, toPaise } from "../utils/money.js";

const toQuantity = (value) => {
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity <= 0) throw new ApiError(422, "Item quantity must be greater than 0.");
  return quantity;
};

/** Authoritative order calculation. Every intermediate monetary value is paise. */
export const calculateOrderAmounts = ({
  items,
  discount = 0,
  gstType = "CGST_SGST",
  gstRate = 0,
  serviceCharge = null,
  serviceChargePercent = 0,
  deliveryCharge = 0,
  orderType = "DINE_IN",
}) => {
  if (!Array.isArray(items) || items.length === 0) throw new ApiError(422, "An order must contain at least one item.");

  const normalizedItems = items.map((item) => {
    const quantity = toQuantity(item.quantity);
    let pricePaise;
    try { pricePaise = toPaise(item.price, { allowNegative: false }); } catch { throw new ApiError(422, "Item price cannot be negative."); }
    const subtotalPaise = multiplyPaise(pricePaise, quantity);
    return { ...item, quantity, price: fromPaise(pricePaise), subtotal: fromPaise(subtotalPaise) };
  });

  const subtotalPaise = normalizedItems.reduce((sum, item) => sum + toPaise(item.subtotal), 0);
  let discountPaise;
  try { discountPaise = clampPaise(toPaise(discount), 0, subtotalPaise); } catch { throw new ApiError(422, "Discount must be a valid amount."); }
  const taxablePaise = subtotalPaise - discountPaise;
  const normalizedRate = normalizeGstRate(gstRate);
  const taxPaise = percentageOfPaise(taxablePaise, normalizedRate);
  const servicePaise = serviceCharge !== null && serviceCharge !== undefined
    ? clampPaise(toPaise(serviceCharge), 0)
    : percentageOfPaise(taxablePaise, Math.max(0, Number(serviceChargePercent) || 0));
  const deliveryPaise = String(orderType).toUpperCase() === "DELIVERY"
    ? clampPaise(toPaise(deliveryCharge), 0)
    : 0;
  const totalPaise = Math.max(0, subtotalPaise - discountPaise + taxPaise + servicePaise + deliveryPaise);
  const cgstPaise = gstType === "IGST" ? 0 : Math.round(taxPaise / 2);
  const sgstPaise = gstType === "IGST" ? 0 : taxPaise - cgstPaise;

  return {
    items: normalizedItems,
    subtotal: fromPaise(subtotalPaise), discount: fromPaise(discountPaise), tax: fromPaise(taxPaise),
    serviceCharge: fromPaise(servicePaise), deliveryCharge: fromPaise(deliveryPaise), taxableAmount: fromPaise(taxablePaise),
    gstRate: normalizedRate, gstType: gstType === "IGST" ? "IGST" : "CGST_SGST",
    cgst: fromPaise(cgstPaise), sgst: fromPaise(sgstPaise), igst: gstType === "IGST" ? fromPaise(taxPaise) : 0,
    total: fromPaise(totalPaise),
  };
};

export const roundCurrency = (value) => fromPaise(toPaise(value));
