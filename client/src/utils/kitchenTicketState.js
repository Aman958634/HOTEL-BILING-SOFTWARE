const NEXT_ITEM_STATUS = { NEW: "PREPARING", PREPARING: "READY", READY: "SERVED" };

const normalized = (value) => String(value || "").toUpperCase();

export const getKitchenTicketKey = (ticket) => String(ticket?.kotId || ticket?.ticketId || ticket?._id || ticket?.orderId || "");

export const deriveKitchenTicketStage = (ticket) => {
  const activeItems = (ticket?.items || []).filter((item) => normalized(item.kitchenStatus) !== "CANCELLED");
  const statuses = activeItems.map((item) => normalized(item.kitchenStatus));

  if (statuses.includes("NEW")) return "NEW";
  if (statuses.includes("PREPARING")) return "PREPARING";
  if (statuses.includes("READY")) return "READY";
  if (statuses.length && statuses.every((status) => status === "SERVED")) return "COMPLETED";

  // Cancelled-only and empty KOTs have no remaining kitchen work. Unknown
  // statuses deliberately stay out of Completed until the API clarifies them.
  if ((ticket?.items || []).length && !activeItems.length) return "COMPLETED";
  return "NEW";
};

export const groupKitchenTickets = (tickets = []) => {
  const newestByKey = new Map();
  tickets.forEach((ticket) => {
    const key = getKitchenTicketKey(ticket);
    if (!key) return;
    const current = newestByKey.get(key);
    if (!current || new Date(ticket.updatedAt || 0).getTime() >= new Date(current.updatedAt || 0).getTime()) newestByKey.set(key, ticket);
  });

  return [...newestByKey.values()].reduce((grouped, ticket) => {
    grouped[deriveKitchenTicketStage(ticket)].push(ticket);
    return grouped;
  }, { NEW: [], PREPARING: [], READY: [], COMPLETED: [] });
};

export const mergeKitchenTicket = (tickets = [], incoming) => {
  const key = getKitchenTicketKey(incoming);
  if (!key) return tickets;
  const index = tickets.findIndex((ticket) => getKitchenTicketKey(ticket) === key);
  if (index < 0) return [incoming, ...tickets];

  const current = tickets[index];
  if (new Date(incoming.updatedAt || 0).getTime() < new Date(current.updatedAt || 0).getTime()) return tickets;
  const next = [...tickets];
  next[index] = { ...current, ...incoming };
  return next;
};

export const getNextKitchenItemStatus = (status) => NEXT_ITEM_STATUS[normalized(status)] || null;
export const isKitchenItemTransitionAllowed = (from, to) => getNextKitchenItemStatus(from) === normalized(to) || (normalized(to) === "CANCELLED" && ["NEW", "PREPARING", "READY"].includes(normalized(from)));
