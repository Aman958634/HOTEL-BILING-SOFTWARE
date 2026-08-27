import jwt from "jsonwebtoken";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";
import { runWithTenantContext } from "../utils/tenantContext.js";
import { resolveUserTenant } from "../utils/tenantResolver.js";

export const outletContext = async (req, _res, next) => {
  if (req.path.startsWith("/public") || req.path.startsWith("/auth")) return next();
  try {
    const auth = String(req.headers.authorization || "");
    if (!auth.startsWith("Bearer ")) return next(new ApiError(401, "Unauthorized"));
    const decoded = jwt.verify(auth.slice(7), process.env.JWT_ACCESS_SECRET);
    const user = await runWithTenantContext(
      { role: "system", restaurantId: null, outletId: null },
      () => User.findById(decoded.id).select("role restaurant outlet restaurantId outletId hotelId isActive")
    );
    if (!user || !user.isActive) return next(new ApiError(401, "User not found or inactive"));

    const context = await resolveUserTenant({ ...user.toObject(), role: user.role });
    const header = req.headers["x-outlet-id"];
    if (header && context.outletId && String(header) !== String(context.outletId)) {
      return next(new ApiError(403, "Outlet does not belong to this session"));
    }
    req.outletId = context.outletId || null;
    req.tenantContext = context;
    return runWithTenantContext(context, () => next());
  } catch (error) {
    if (error.name === "TokenExpiredError") return next(new ApiError(401, "Session expired. Please login again."));
    if (error.name === "JsonWebTokenError") return next(new ApiError(401, "Invalid token"));
    return next(error instanceof ApiError ? error : new ApiError(403, "Unable to resolve tenant context"));
  }
};
