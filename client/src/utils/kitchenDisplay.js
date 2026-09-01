const COMPLETED_STATUSES = new Set(["SERVED", "COMPLETED"]);

// Keep every KDS view (filters, summary chips, and columns) on the same
// backend-derived phase. A completed order must not also render as New.
export const getTicketBoardPhase = (ticket) => {
  const phase = String(ticket?.kitchenPhase || "").toUpperCase();
  const orderStatus = String(ticket?.status || "").toUpperCase();

  if (phase === "COMPLETED" || COMPLETED_STATUSES.has(orderStatus)) return "COMPLETED";
  if (phase === "READY") return "READY";
  if (["PREPARING", "PARTIALLY_READY"].includes(phase)) return "PREPARING";
  return "NEW";
};
