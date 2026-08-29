import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Outlet from "../models/Outlet.js";
import { ensureDefaultOutlet } from "../services/outletService.js";
import ApiError from "../utils/ApiError.js";

export const protect = async (req, _, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return next(new ApiError(401, "Unauthorized"));
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user || !user.isActive) {
      return next(new ApiError(401, "User not found or inactive"));
    }

    req.user = {
      _id: user._id,
      role: user.role,
      hotelId: user.hotelId || null,
      restaurant: user.restaurant || null,
      email: user.email,
      fullName: user.fullName,
      isActive: user.isActive,
      defaultOutlet: user.defaultOutlet || null,
      outletAccess: user.outletAccess || [],
    };
    if (user.restaurant) await ensureDefaultOutlet({ _id: user.restaurant });

    // Outlet selection is only a requested context. It is authorized here on
    // the server and is never accepted from a request body/query string.
    const requestedOutletId = req.get("X-Outlet-Id");
    if (requestedOutletId) {
      if (!/^[a-f\d]{24}$/i.test(requestedOutletId)) return next(new ApiError(400, "Invalid outlet id"));
      const elevated = ["admin", "restaurant_admin", "hotel_admin", "super_admin"].includes(user.role);
      const legacyDefault = !(user.outletAccess || []).length;
      const allowed = elevated || legacyDefault || (user.outletAccess || []).some((entry) => entry.isActive !== false && String(entry.outlet) === String(requestedOutletId));
      const outlet = allowed ? await Outlet.findOne({ _id: requestedOutletId, restaurant: user.restaurant, isActive: true }).select("_id restaurant").lean() : null;
      if (!outlet) return next(new ApiError(403, "You do not have access to the requested outlet"));
      req.user.activeOutlet = outlet._id;
    }

    return next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return next(new ApiError(401, "Session expired. Please login again."));
    }

    if (error.name === "JsonWebTokenError") {
      return next(new ApiError(401, "Invalid token"));
    }

    return next(new ApiError(401, "Unauthorized"));
  }
};

export const authorize = (...roles) => (req, _, next) => {
  if (!req.user) {
    return next(new ApiError(401, "Unauthorized"));
  }
  if (req.user.role === "super_admin") {
    return next();
  }
  if (!roles.includes(req.user.role)) {
    return next(new ApiError(403, "Forbidden"));
  }
  next();
};
