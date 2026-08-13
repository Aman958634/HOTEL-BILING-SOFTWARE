import { validationResult } from "express-validator";
import ApiError from "../utils/ApiError.js";

export const validate = (req, _, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ApiError(422, errors.array().map((e) => e.msg).join(", ")));
  }
  next();
};
