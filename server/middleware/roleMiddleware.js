import ApiError from "../utils/ApiError.js";

export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) {
    return next(new ApiError(401, "Unauthorized"));
  }

  if (req.user.role === "super_admin") {
    return next();
  }

  if (!roles.includes(req.user.role)) {
    return next(new ApiError(403, "Forbidden"));
  }

  return next();
};
