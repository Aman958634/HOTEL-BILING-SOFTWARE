import mongoose from "mongoose";
import ApiResponse from "../utils/ApiResponse.js";

/** Block DB-dependent routes when MongoDB is not connected. */
export const requireDb = (_req, res, next) => {
  if (mongoose.connection.readyState === 1) {
    return next();
  }
  return res.status(503).json(new ApiResponse(false, "Database temporarily unavailable"));
};

export default { requireDb };
