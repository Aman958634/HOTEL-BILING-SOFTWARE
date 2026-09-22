import { Router } from "express";
import { body } from "express-validator";
import { forgotPassword, login, logout, me, refresh, register, resetPassword } from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { loginLimiter, passwordResetLimiter, signupLimiter } from "../middleware/rateLimiter.js";

const router = Router();

router.post(
  "/register",
  signupLimiter,
  [
    body("fullName").trim().isLength({ min: 1, max: 120 }).withMessage("Full name is required"),
    body("email").trim().normalizeEmail().isEmail().isLength({ max: 254 }).withMessage("Enter a valid email address."),
    body("phone").optional({ values: "falsy" }).trim().matches(/^(?:\+91[\s-]?)?[6-9]\d{9}$/).withMessage("Enter a valid mobile number."),
    body("password").isString().isLength({ min: 8, max: 128 }).withMessage("Password must be between 8 and 128 characters"),
  ],
  validate,
  register
);
router.post(
  "/login",
  loginLimiter,
  [
    body("email").trim().normalizeEmail().isEmail().isLength({ max: 254 }).withMessage("Enter a valid email address."),
    body("password").isString().notEmpty().isLength({ max: 128 }).withMessage("Password is required"),
  ],
  validate,
  login
);
router.post("/refresh", [body("refreshToken").isString().trim().isLength({ min: 20, max: 4096 }).withMessage("Invalid refresh token")], validate, refresh);
router.post("/logout", logout);
router.post("/forgot-password", passwordResetLimiter, [body("email").trim().normalizeEmail().isEmail().isLength({ max: 254 }).withMessage("Enter a valid email address.")], validate, forgotPassword);
router.post("/reset-password/:token", passwordResetLimiter, [body("password").isString().isLength({ min: 8, max: 128 }).withMessage("Password must be between 8 and 128 characters")], validate, resetPassword);
router.get("/me", protect, me);

export default router;
