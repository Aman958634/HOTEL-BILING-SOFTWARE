import { body, param, query } from "express-validator";

const USER_ROLES = [
  "super_admin",
  "hotel_admin",
  "restaurant_admin",
  "manager",
  "staff",
  "cashier",
  "admin",
  "chef",
  "waiter",
  "delivery",
  "receptionist",
  "inventory_manager",
  "customer",
];

export const userListValidation = [
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be at least 1"),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
  query("role").optional().isIn(USER_ROLES).withMessage("Invalid user role"),
  query("status").optional().isIn(["active", "inactive"]).withMessage("Invalid status"),
];

export const userIdValidation = [param("id").isMongoId().withMessage("Invalid user id")];

export const userCreateValidation = [
  body("fullName").trim().notEmpty().withMessage("Full name is required"),
  body("email").isEmail().withMessage("Valid email is required"),
  body("password").optional({ values: "falsy" }).isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
  body("phone").optional({ values: "falsy" }).trim().isLength({ min: 10, max: 15 }).withMessage("Phone must be 10 to 15 digits"),
  body("role").optional().isIn(USER_ROLES).withMessage("Invalid user role"),
  body("restaurant").optional({ values: "falsy" }).isMongoId().withMessage("Invalid restaurant id"),
  body("hotelId").optional({ values: "falsy" }).isMongoId().withMessage("Invalid hotel id"),
  body("isActive").optional().isBoolean().withMessage("isActive must be a boolean").toBoolean(),
];

export const userUpdateValidation = [
  body("fullName").optional().trim().notEmpty().withMessage("Full name is required"),
  body("email").optional().isEmail().withMessage("Valid email is required"),
  body("password").optional({ values: "falsy" }).isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
  body("phone").optional({ values: "falsy" }).trim().isLength({ min: 10, max: 15 }).withMessage("Phone must be 10 to 15 digits"),
  body("role").optional().isIn(USER_ROLES).withMessage("Invalid user role"),
  body("restaurant").optional({ values: "falsy" }).isMongoId().withMessage("Invalid restaurant id"),
  body("hotelId").optional({ values: "falsy" }).isMongoId().withMessage("Invalid hotel id"),
  body("isActive").optional().isBoolean().withMessage("isActive must be a boolean").toBoolean(),
];

export const userStatusValidation = [
  body("status").isIn(["active", "inactive"]).withMessage("Invalid status"),
];
