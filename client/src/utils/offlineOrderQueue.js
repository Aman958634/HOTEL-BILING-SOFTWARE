const STORAGE_KEY = "restosphere.offlineOrders.v1";
const VERSION = 1;
const MAX_PENDING = 50;

const readStore = () => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeStore = (records) => {
  if (records.length) localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  else localStorage.removeItem(STORAGE_KEY);
};

export const getOfflineOrderScope = ({ user, outletId }) => {
  const userId = user?._id || user?.id;
  const restaurantId = user?.restaurant?._id || user?.restaurant?.id || user?.restaurant;
  if (!userId || !restaurantId || !outletId) return null;
  return `${String(userId)}:${String(restaurantId)}:${String(outletId)}`;
};

export const listPendingOfflineOrders = (scope) => readStore().filter((record) => record.scope === scope && record.state !== "SYNCED");

export const savePendingOfflineOrder = ({ scope, outletId, userId, restaurantId, payload, idempotencyKey }) => {
  if (!scope || !payload?.items?.length || !idempotencyKey) throw new Error("Offline order intent is incomplete");
  const records = readStore().filter((record) => record.version === VERSION);
  const existing = records.find((record) => record.scope === scope && record.idempotencyKey === idempotencyKey);
  if (existing) return existing;
  if (records.filter((record) => record.scope === scope && record.state !== "SYNCED").length >= MAX_PENDING) throw new Error("Offline order queue is full. Sync or resolve pending orders first.");
  const record = {
    version: VERSION,
    localOperationId: globalThis.crypto?.randomUUID?.() || `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    idempotencyKey: String(idempotencyKey).slice(0, 200),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    scope,
    userId: String(userId),
    restaurantId: String(restaurantId),
    outletId: String(outletId),
    state: "PENDING_SYNC",
    attempts: 0,
    payload: {
      orderType: payload.orderType,
      table: payload.orderType === "DINE_IN" ? payload.table || "" : "",
      items: payload.items.map(({ menuItem, quantity, specialInstructions }) => ({ menuItem, quantity, ...(specialInstructions ? { specialInstructions } : {}) })),
      specialInstructions: String(payload.specialInstructions || "").slice(0, 2000),
      notes: String(payload.notes || "").slice(0, 2000),
      deliveryAddress: String(payload.deliveryAddress || "").slice(0, 2000),
      discount: payload.discount,
      serviceChargePercent: payload.serviceChargePercent,
      deliveryCharge: payload.deliveryCharge,
    },
  };
  try {
    records.push(record);
    writeStore(records);
    return record;
  } catch (error) {
    throw new Error("Unable to persist offline order intent");
  }
};

export const markOfflineOrderAttempt = (localOperationId, state, errorCategory = "") => {
  const records = readStore();
  const record = records.find((item) => item.localOperationId === localOperationId);
  if (!record) return null;
  record.state = state;
  record.attempts += 1;
  record.lastAttemptAt = new Date().toISOString();
  record.lastSafeErrorCategory = String(errorCategory).slice(0, 120);
  record.updatedAt = new Date().toISOString();
  writeStore(records);
  return record;
};

export const removeOfflineOrder = (localOperationId) => writeStore(readStore().filter((record) => record.localOperationId !== localOperationId));
export const clearOfflineOrders = () => localStorage.removeItem(STORAGE_KEY);
export const offlineOrderStorageKey = STORAGE_KEY;
