import { Router } from "express";
import { body } from "express-validator";
import { forgotPassword, login, logout, me, refresh, register, resetPassword } from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { authLimiter } from "../middleware/rateLimiter.js";

const router = Router();

router.post(
  "/register",
  authLimiter,
  [
    body("fullName").trim().notEmpty().withMessage("Full name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("phone").optional().isLength({ min: 10, max: 10 }).withMessage("Phone must be 10 digits"),
    body("password").isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
  ],
  validate,
  register
);
router.post(
  "/login",
  authLimiter,
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  validate,
  login
);
router.post("/refresh", [body("refreshToken").notEmpty()], validate, refresh);
router.post("/logout", logout);
router.post("/forgot-password", authLimiter, [body("email").isEmail()], validate, forgotPassword);
router.post("/reset-password/:token", authLimiter, [body("password").isLength({ min: 8, max: 128 })], validate, resetPassword);
router.get("/me", protect, me);

export default router;
