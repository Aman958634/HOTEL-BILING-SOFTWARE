export const ACCESS_LEVELS = Object.freeze(["ROLE_DEFAULT", "FULL_ACCESS", "CUSTOM_ACCESS"]);

export const PERMISSION_KEYS = Object.freeze([
  "kds.view", "kds.update_status",
  "orders.view", "orders.view_kitchen", "orders.create", "orders.edit", "orders.cancel",
  "billing.view", "billing.generate",
  "payments.view", "payments.collect", "payments.reconcile",
  "settlements.view", "settlements.manage",
  "inventory.view", "inventory.manage",
  "staff.view", "staff.manage",
  "reports.view_basic", "reports.view_full",
]);

const permissions = (...keys) => Object.freeze(keys);

export const ROLE_DEFAULT_PERMISSIONS = Object.freeze({
  chef: permissions("kds.view", "kds.update_status", "orders.view_kitchen"),
  kitchen_manager: permissions("kds.view", "kds.update_status", "orders.view", "orders.create", "orders.edit"),
  cashier: permissions("orders.view", "orders.create", "orders.edit", "billing.view", "billing.generate", "payments.view", "payments.collect", "reports.view_basic"),
  manager: permissions(
    "kds.view", "kds.update_status", "orders.view", "orders.create", "orders.edit", "orders.cancel",
    "billing.view", "billing.generate", "payments.view", "payments.collect", "payments.reconcile",
    "inventory.view", "inventory.manage", "staff.view", "staff.manage", "reports.view_basic", "reports.view_full",
  ),
});

export const FULL_ACCESS_PERMISSIONS = permissions(...PERMISSION_KEYS);

export const normalizeAccessLevel = (value) => {
  const normalized = String(value || "ROLE_DEFAULT").trim().toUpperCase();
  return ACCESS_LEVELS.includes(normalized) ? normalized : "ROLE_DEFAULT";
};

export const normalizePermissions = (values) => [...new Set((Array.isArray(values) ? values : []).filter((value) => PERMISSION_KEYS.includes(value)))];

export const resolvePermissions = ({ role, accessLevel = "ROLE_DEFAULT", customPermissions = [] } = {}) => {
  const normalizedRole = String(role || "").trim().toLowerCase();
  const mode = normalizeAccessLevel(accessLevel);
  if (normalizedRole === "admin" || normalizedRole === "restaurant_admin" || normalizedRole === "hotel_admin") return [...FULL_ACCESS_PERMISSIONS];
  if (mode === "FULL_ACCESS") return [...FULL_ACCESS_PERMISSIONS];
  if (mode === "CUSTOM_ACCESS") return normalizePermissions(customPermissions);
  return [...(ROLE_DEFAULT_PERMISSIONS[normalizedRole] || [])];
};

export const hasPermission = (user, permission) => user?.role === "super_admin" || resolvePermissions(user).includes(permission);

export const permissionFor = (module, action) => `${module}.${action}`;
