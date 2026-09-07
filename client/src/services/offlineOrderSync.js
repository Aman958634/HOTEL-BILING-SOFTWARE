import { createOrder } from "./orderService";
import { listPendingOfflineOrders, markOfflineOrderAttempt, removeOfflineOrder } from "../utils/offlineOrderQueue";

const safeCategory = (error) => {
  const status = Number(error?.response?.status || 0);
  if (!status) return "NETWORK";
  if (status === 401) return "AUTH";
  if (status === 403) return "FORBIDDEN";
  if (status === 409) return "CONFLICT";
  if (status === 422) return "VALIDATION";
  if (status === 429) return "RATE_LIMIT";
  if (status >= 500) return "SERVER";
  return "REQUEST";
};

export const syncOfflineOrder = async (record) => {
  if (!record?.idempotencyKey || record.state === "SYNCING") throw new Error("Offline order is not syncable");
  markOfflineOrderAttempt(record.localOperationId, "SYNCING");
  try {
    const response = await createOrder(record.payload, record.idempotencyKey);
    removeOfflineOrder(record.localOperationId);
    return response.data?.data || null;
  } catch (error) {
    markOfflineOrderAttempt(record.localOperationId, "SYNC_FAILED", safeCategory(error));
    throw error;
  }
};

export const syncPendingOfflineOrders = async (scope) => {
  const records = listPendingOfflineOrders(scope).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  const results = [];
  for (const record of records) {
    try { results.push({ record, order: await syncOfflineOrder(record) }); }
    catch (error) { results.push({ record, error }); }
  }
  return results;
};
