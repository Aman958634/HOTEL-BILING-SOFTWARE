const idOf = (value) => String(value?._id || value?.id || value || "");

/**
 * Applies only an authoritative, canonical PAID order response. Keeping this
 * separate makes the cash-confirmation UI fast without ever optimisticly
 * marking a sale as settled.
 */
export const applyAuthoritativeCashPayment = (orders = [], confirmedOrder) => {
  if (String(confirmedOrder?.paymentStatus || "").toUpperCase() !== "PAID") return orders;
  const confirmedId = idOf(confirmedOrder);
  if (!confirmedId) return orders;

  return (orders || []).map((order) => (
    idOf(order) === confirmedId
      ? { ...order, ...confirmedOrder, paymentStatus: "PAID", paymentMethod: confirmedOrder.paymentMethod || "CASH" }
      : order
  ));
};
