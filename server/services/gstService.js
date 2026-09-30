export const DEFAULT_GST_RATE = 0;

const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
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
  const taxable = Math.max(0, Number(taxableAmount || 0));
  const rate = normalizeGstRate(gstRate);
  const totalTax = round2((taxable * rate) / 100);
  if (gstType === "IGST") {
    return { gstType: "IGST", gstRate: rate, cgst: 0, sgst: 0, igst: totalTax, totalTax };
  }

  const cgst = round2(totalTax / 2);
  const sgst = round2(totalTax - cgst);
  return { gstType: "CGST_SGST", gstRate: rate, cgst, sgst, igst: 0, totalTax };
};
