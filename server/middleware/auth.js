import jwt from "jsonwebtoken";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import { runWithTenantContext } from "../utils/tenantContext.js";
import { resolveUserTenant } from "../utils/tenantResolver.js";

export const protect = async (req, _, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return next(new ApiError(401, "Unauthorized"));
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await runWithTenantContext(
      { role: "system", restaurantId: null, outletId: null },
      async () => await User.findById(decoded.id).select("-password")
    );

    if (!user || !user.isActive) {
      return next(new ApiError(401, "User not found or inactive"));
    }

    const tenant = await resolveUserTenant({ ...user.toObject(), role: user.role });
    req.outletId = req.outletId || tenant.outletId || null;
    req.user = {
      _id: user._id,
      role: user.role,
      hotelId: user.hotelId || null,
      restaurant: user.restaurant || null,
      restaurantId: user.restaurant || null,
      outlet: req.outletId,
      outletId: req.outletId,
      email: user.email,
      fullName: user.fullName,
      isActive: user.isActive,
    };
    return runWithTenantContext(tenant, () => next());
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
