import Outlet from "../models/Outlet.js";
import ApiError from "../utils/ApiError.js";

const validAccessRoles = new Set(["admin", "restaurant_admin", "hotel_admin", "super_admin"]);

export const getAllowedOutlets = async (user, { includeInactive = false } = {}) => {
  if (!user?.restaurant) return [];
  const filter = { restaurant: user.restaurant, ...(includeInactive ? {} : { isActive: true }) };
  if (validAccessRoles.has(String(user.role || "").toLowerCase()) || user.allOutletsAccess === true) return Outlet.find(filter).sort({ isDefault: -1, name: 1 }).lean();
  const allowedIds = (user.outletAccess || []).filter((entry) => entry.isActive !== false).map((entry) => entry.outlet || entry).filter(Boolean);
  if (!allowedIds.length) return [];
  return Outlet.find({ ...filter, _id: { $in: allowedIds } }).sort({ isDefault: -1, name: 1 }).lean();
};

export const resolveAuthorizedOutlet = async ({ user, outletId }) => {
  const outlets = await getAllowedOutlets(user);
  if (!outlets.length) throw new ApiError(403, "No active outlet is assigned to this user");
  const selected = outletId ? outlets.find((outlet) => String(outlet._id) === String(outletId)) : outlets.find((outlet) => String(outlet._id) === String(user.defaultOutlet)) || outlets.find((outlet) => outlet.isDefault) || outlets[0];
  if (!selected) throw new ApiError(403, "You do not have access to the requested outlet");
  return selected;
};

export const ensureDefaultOutlet = async (restaurant) => {
  const existing = await Outlet.findOne({ restaurant: restaurant._id }).sort({ isDefault: -1, createdAt: 1 });
  if (existing) return existing;
  return Outlet.create({ restaurant: restaurant._id, name: "Main Outlet", code: "MAIN", address: restaurant.address || "", city: restaurant.city || "", state: restaurant.state || "", phone: restaurant.phone || "", email: restaurant.email || "", timeZone: restaurant.timeZone || "Asia/Kolkata", gstNumber: restaurant.gstNumber || "", isDefault: true });
};
