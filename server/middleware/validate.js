import { validationResult } from "express-validator";
import ApiError from "../utils/ApiError.js";

export const validate = (req, _, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const fields = {};
    for (const error of errors.array()) {
      const field = String(error.path || error.param || "form");
      // Retain the first message per field: it is the most actionable one and
      // prevents a single input from flooding small/mobile form layouts.
      if (!fields[field]) fields[field] = error.msg;
    }
    return next(new ApiError(422, "Please correct the highlighted fields.", "VALIDATION_ERROR", { fields }));
  }
  next();
};
