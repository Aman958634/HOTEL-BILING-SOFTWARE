export const GST_RATE = 0.18;
export const GST_HALF_RATE = 0.09;

const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const normalizeState = (value) => String(value || "").trim().toLowerCase();

export const resolveGstType = ({ restaurantState, billingState } = {}) => {
  const source = normalizeState(restaurantState);
  const destination = normalizeState(billingState);
  return source && destination && source !== destination ? "IGST" : "CGST_SGST";
};

export const calculateGst = (taxableAmount, gstType = "CGST_SGST") => {
  const taxable = Math.max(0, Number(taxableAmount || 0));
  const totalTax = round2(taxable * GST_RATE);
  if (gstType === "IGST") {
    return { gstType: "IGST", cgst: 0, sgst: 0, igst: totalTax, totalTax };
  }

  const cgst = round2(taxable * GST_HALF_RATE);
  const sgst = round2(totalTax - cgst);
  return { gstType: "CGST_SGST", cgst, sgst, igst: 0, totalTax };
};
