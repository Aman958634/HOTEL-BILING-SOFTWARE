import { fromPaise, percentageOfPaise, toPaise } from "../utils/money.js";

export const DEFAULT_GST_RATE = 0;
const normalizeState = (value) => String(value || "").trim().toLowerCase();

export const normalizeGstRate = (value) => {
  const rate = Number(value);
  return Number.isFinite(rate) && rate >= 0 && rate <= 100 ? rate : DEFAULT_GST_RATE;
};

export const resolveGstType = ({ restaurantState, billingState } = {}) => {
  const source = normalizeState(restaurantState);
  const destination = normalizeState(billingState);
  return source && destination && source !== destination ? "IGST" : "CGST_SGST";
};

export const calculateGst = (taxableAmount, gstType = "CGST_SGST", gstRate = DEFAULT_GST_RATE) => {
  const taxablePaise = Math.max(0, toPaise(taxableAmount));
  const rate = normalizeGstRate(gstRate);
  const totalTaxPaise = percentageOfPaise(taxablePaise, rate);
  if (gstType === "IGST") {
    return { gstType: "IGST", gstRate: rate, cgst: 0, sgst: 0, igst: fromPaise(totalTaxPaise), totalTax: fromPaise(totalTaxPaise) };
  }
  const cgstPaise = Math.round(totalTaxPaise / 2);
  const sgstPaise = totalTaxPaise - cgstPaise;
  return { gstType: "CGST_SGST", gstRate: rate, cgst: fromPaise(cgstPaise), sgst: fromPaise(sgstPaise), igst: 0, totalTax: fromPaise(totalTaxPaise) };
};
