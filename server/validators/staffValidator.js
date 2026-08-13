import { body, param, query } from "express-validator";
import { STAFF_DEPARTMENTS, STAFF_ROLES, STAFF_STATUSES } from "../services/staffService.js";

const optionalEmail = body("email").optional({ values: "falsy" }).isEmail().withMessage("Email must be valid");

export const staffListValidation = [
  query("page").optional().isInt({ min: 1 }).withMessage("Page must be at least 1"),
  query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
  query("role").optional().isIn(STAFF_ROLES).withMessage("Invalid staff role"),
  query("department").optional().isIn(STAFF_DEPARTMENTS).withMessage("Invalid department"),
  query("status").optional().isIn(STAFF_STATUSES).withMessage("Invalid status"),
  query("shift").optional().isString().withMessage("Invalid shift"),
];

export const staffIdValidation = [param("id").isMongoId().withMessage("Invalid staff id")];

export const staffRoleValidation = [param("role").isIn(STAFF_ROLES).withMessage("Invalid staff role")];

export const staffCreateValidation = [
  body("firstName").trim().notEmpty().withMessage("First name is required"),
  body("lastName").trim().notEmpty().withMessage("Last name is required"),
  body("phone").trim().notEmpty().isLength({ min: 10, max: 15 }).withMessage("Phone must be 10 to 15 digits"),
  optionalEmail,
  body("role").isIn(STAFF_ROLES).withMessage("Invalid staff role"),
  body("department").isIn(STAFF_DEPARTMENTS).withMessage("Invalid department"),
  body("joiningDate").notEmpty().isISO8601().withMessage("Joining date is required"),
  body("salary").optional().isFloat({ min: 0 }).withMessage("Salary cannot be negative"),
  body("status").optional().isIn(STAFF_STATUSES).withMessage("Invalid status"),
  body("password").optional().isLength({ min: 8 }).withMessage("Password must be at least 8 characters"),
  body("shift").optional({ values: "falsy" }).isString().withMessage("Invalid shift"),
];

export const staffUpdateValidation = [
  param("id").isMongoId().withMessage("Invalid staff id"),
  body("firstName").optional().trim().notEmpty().withMessage("First name is required"),
  body("lastName").optional().trim().notEmpty().withMessage("Last name is required"),
  body("phone").optional().trim().isLength({ min: 10, max: 15 }).withMessage("Phone must be 10 to 15 digits"),
  optionalEmail,
  body("role").optional().isIn(STAFF_ROLES).withMessage("Invalid staff role"),
  body("department").optional().isIn(STAFF_DEPARTMENTS).withMessage("Invalid department"),
  body("joiningDate").optional().isISO8601().withMessage("Invalid joining date"),
  body("salary").optional().isFloat({ min: 0 }).withMessage("Salary cannot be negative"),
  body("status").optional().isIn(STAFF_STATUSES).withMessage("Invalid status"),
  body("shift").optional({ values: "falsy" }).isString().withMessage("Invalid shift"),
];

export const staffStatusValidation = [
  param("id").isMongoId().withMessage("Invalid staff id"),
  body("status").isIn(STAFF_STATUSES).withMessage("Invalid status"),
];

export const staffDeleteValidation = [param("id").isMongoId().withMessage("Invalid staff id")];
