const STORAGE_KEY = "restosphere.orderDraft.v1";
const VERSION = 1;

const readStore = () => {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return {};
  }
};

export const getOrderDraftScope = ({ user, outletId }) => {
  const userId = user?._id || user?.id;
  const restaurantId = user?.restaurant?._id || user?.restaurant?.id || user?.restaurant;
  if (!userId || !restaurantId || !outletId) return null;
  return `${String(userId)}:${String(restaurantId)}:${String(outletId)}`;
};

export const readOrderDraft = (scope) => {
  if (!scope) return null;
  const draft = readStore()[scope];
  if (!draft || draft.version !== VERSION || draft.scope !== scope || !Array.isArray(draft.items)) {
    if (draft) clearOrderDraft(scope);
    return null;
  }
  return draft;
};

export const writeOrderDraft = (scope, form) => {
  if (!scope || !form?.items?.length) return;
  try {
    const store = readStore();
    store[scope] = {
      version: VERSION,
      scope,
      savedAt: Date.now(),
      orderType: form.orderType,
      table: form.orderType === "DINE_IN" ? form.table || "" : "",
      items: form.items.map(({ menuItem, quantity }) => ({ menuItem, quantity })),
      specialInstructions: String(form.specialInstructions || "").slice(0, 2000),
      notes: String(form.notes || "").slice(0, 2000),
      discountPercent: String(form.discountPercent || ""),
      taxPercent: Number(form.taxPercent) || 0,
      serviceChargePercent: String(form.serviceChargePercent || ""),
      deliveryCharge: String(form.deliveryCharge || ""),
      deliveryAddress: String(form.deliveryAddress || "").slice(0, 2000),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Storage failure must not interrupt online order creation.
  }
};

export const clearOrderDraft = (scope) => {
  if (!scope) return;
  try {
    const store = readStore();
    delete store[scope];
    if (Object.keys(store).length) localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage failure is non-blocking.
  }
};

export const clearAllOrderDrafts = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage failure is non-blocking.
  }
};
