import ApiError from "../utils/ApiError.js";

export const requireHotelAccess = (req, _, next) => {
  if (!req.user) {
    return next(new ApiError(401, "Unauthorized"));
  }

  if (req.user.role === "super_admin") {
    return next();
  }

  if (!req.user.hotelId) {
    return next(new ApiError(403, "Hotel access required"));
  }

  req.hotelId = req.user.hotelId;
  return next();
};

export const requireSuperAdmin = (req, _, next) => {
  if (!req.user) {
    return next(new ApiError(401, "Unauthorized"));
  }

  if (req.user.role !== "super_admin") {
    return next(new ApiError(403, "Forbidden"));
  }

  next();
};
