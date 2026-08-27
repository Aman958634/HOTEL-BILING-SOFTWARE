import jwt from "jsonwebtoken";
import ApiError from "../utils/ApiError.js";
import { runWithTenantContext } from "../utils/tenantContext.js";

export const outletContext = (req, _res, next) => {
  if (req.path.startsWith("/public") || req.path.startsWith("/auth")) return next();
  const header = req.headers["x-outlet-id"];
  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  let tokenOutlet = null;
  let tokenRole = null;
  let tokenRestaurant = null;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      tokenOutlet = decoded?.outletId || null;
      tokenRole = decoded?.role || null;
      tokenRestaurant = decoded?.restaurant || null;
    } catch {
      return next(new ApiError(401, "Invalid token"));
    }
  }
  if (!tokenOutlet && tokenRole === "super_admin") return runWithTenantContext({ role: tokenRole }, () => next());
  if (!tokenOutlet) return next(new ApiError(403, "Outlet context is required"));
  if (header && String(header) !== String(tokenOutlet)) return next(new ApiError(403, "Outlet does not belong to this session"));
  req.outletId = tokenOutlet;
  runWithTenantContext({ role: tokenRole, restaurantId: tokenRestaurant, outletId: tokenOutlet }, () => next());
};
