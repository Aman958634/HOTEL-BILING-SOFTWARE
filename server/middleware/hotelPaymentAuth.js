import ApiError from "../utils/ApiError.js";

const HOTEL_PAYMENT_ADMIN_ROLES = new Set(["admin", "hotel_admin", "restaurant_admin"]);

/** Hotel UPI destination details are administrator-managed configuration. */
export const canManageHotelPaymentSettings = (user) => {
  if (!user) return false;
  if (String(user.role || "").toLowerCase() === "super_admin") return true;
  return HOTEL_PAYMENT_ADMIN_ROLES.has(String(user.role || "").toLowerCase());
};

export const requireHotelPaymentSettingsAdmin = (req, _, next) => {
  if (!req.user) return next(new ApiError(401, "Unauthorized"));
  if (canManageHotelPaymentSettings(req.user)) return next();
  return next(new ApiError(403, "Only an authorized hotel administrator can change Hotel UPI settings.", "PERMISSION_DENIED"));
};
