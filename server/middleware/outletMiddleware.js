import jwt from "jsonwebtoken";
import ApiError from "../utils/ApiError.js";

export const outletContext = (req, _res, next) => {
  if (req.path.startsWith("/public") || req.path.startsWith("/auth")) return next();
  const header = req.headers["x-outlet-id"];
  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  let tokenOutlet = null;
  let tokenRole = null;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      tokenOutlet = decoded?.outletId || null;
      tokenRole = decoded?.role || null;
    } catch {
      return next(new ApiError(401, "Invalid token"));
    }
  }
  if (!tokenOutlet && tokenRole === "super_admin") return next();
  if (!tokenOutlet) return next(new ApiError(403, "Outlet context is required"));
  if (header && String(header) !== String(tokenOutlet)) return next(new ApiError(403, "Outlet does not belong to this session"));
  req.outletId = tokenOutlet;
  next();
};
