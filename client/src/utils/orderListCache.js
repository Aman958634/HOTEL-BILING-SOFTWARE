const cache = new Map();
const inFlight = new Map();
const MAX_CACHE_ENTRIES = 30;

const idOf = (value) => String(value?._id || value?.id || value || "");

const permissionScope = (user = {}) => [
  String(user.role || "").toLowerCase(),
  String(user.accessLevel || "").toUpperCase(),
  [...(user.customPermissions || []), ...(user.permissions || [])].map(String).sort().join(","),
].join(":");

export const createOrderListScope = ({ user, activeOutletId, authorizedOutlets = [] } = {}) => {
  const userId = idOf(user?._id || user?.id);
  const restaurantId = idOf(user?.restaurant);
  const outletId = idOf(activeOutletId);
  const outletIds = (authorizedOutlets || []).map(idOf).filter(Boolean).sort();

  if (!userId || !restaurantId || !outletId || !outletIds.includes(outletId)) return "";

  return [userId, restaurantId, outletId, outletIds.join(","), permissionScope(user)].join("|");
};

export const createOrderListCacheKey = (scope, filters = {}) => {
  if (!scope) return "";
  return `${scope}|${JSON.stringify({
    page: Number(filters.page) || 1,
    search: String(filters.search || ""),
    status: String(filters.status || ""),
    orderType: String(filters.orderType || ""),
    paymentStatus: String(filters.paymentStatus || ""),
    date: String(filters.date || ""),
    sortBy: String(filters.sortBy || "newest"),
  })}`;
};

export const getCachedOrderList = (key) => {
  const entry = cache.get(key);
  if (!entry) return null;
  return { orders: [...entry.orders], meta: { ...entry.meta } };
};

export const cacheOrderList = (key, orders, meta) => {
  if (!key) return;
  cache.delete(key);
  cache.set(key, { orders: [...(orders || [])], meta: { ...(meta || {}) } });
  if (cache.size > MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value);
};

export const getSharedOrderListRequest = (key, request) => {
  if (!key) return request();
  if (!inFlight.has(key)) {
    const pending = Promise.resolve().then(request).finally(() => inFlight.delete(key));
    inFlight.set(key, pending);
  }
  return inFlight.get(key);
};

export const clearOrderListCache = () => {
  cache.clear();
  inFlight.clear();
};
