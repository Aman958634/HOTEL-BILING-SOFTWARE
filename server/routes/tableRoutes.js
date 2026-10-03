import { Router } from "express";
import { body, param, query } from "express-validator";
import QRCode from "qrcode";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { requireActiveSubscription } from "../middleware/subscriptionMiddleware.js";
import { validate } from "../middleware/validate.js";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { buildRestaurantQuery } from "../utils/tenantUtils.js";
import Table from "../models/Table.js";
import { createPublicMenuContext } from "../utils/publicMenuContext.js";
import {
  createTable,
  deleteTable,
  getAvailableTables,
  getTableById,
  getTableStats,
  getTables,
  updateTable,
  updateTableStatus,
} from "../controllers/tableController.js";

const validateOptionalCapacity = (value) => {
  if (value === undefined || value === null) return true;
  const capacity = Number(value);
  if (typeof value === "boolean" || String(value).trim() === "" || !Number.isInteger(capacity) || capacity < 1) {
    throw new Error("Capacity must be at least 1");
  }
  return true;
};

const validateOptionalFloor = (value) => {
  if (value === undefined || value === null) return true;
  if (!String(value).trim()) throw new Error("Floor must not be empty");
  return true;
};

const validateOptionalShape = (value) => {
  if (value === undefined || value === null) return true;
  if (!["ROUND", "SQUARE", "RECTANGLE", "round", "square", "rectangle"].includes(String(value))) {
    throw new Error("Shape must be ROUND, SQUARE, or RECTANGLE");
  }
  return true;
};

const router = Router();

router.use(authMiddleware, requireActiveSubscription, requireRole("admin", "manager", "waiter", "cashier"));

router.get(
  "/",
  [
    query("capacity").optional().isInt({ min: 1 }).withMessage("Capacity must be at least 1"),
    query("minCapacity").optional().isInt({ min: 1 }).withMessage("Minimum capacity must be at least 1"),
    query("maxCapacity").optional().isInt({ min: 1 }).withMessage("Maximum capacity must be at least 1"),
  ],
  validate,
  getTables
);

router.get("/stats", getTableStats);

router.get(
  "/available",
  [
    query("date").optional().isISO8601({ strict: true }).withMessage("Date must be in YYYY-MM-DD format"),
    query("time").optional().matches(/^([01]\d|2[0-3]):([0-5]\d)$/).withMessage("Time must be in HH:mm format"),
    query("guests").optional().isInt({ min: 1 }).withMessage("Guests must be at least 1"),
  ],
  validate,
  getAvailableTables
);

router.get("/:id", [param("id").isMongoId().withMessage("Invalid table id")], validate, getTableById);

router.post(
  "/",
  [
    body("tableNumber").trim().notEmpty().withMessage("Table number is required"),
    body("capacity").custom(validateOptionalCapacity),
    body("floor").custom(validateOptionalFloor),
    body("section").trim().notEmpty().withMessage("Section is required"),
    body("shape").custom(validateOptionalShape),
    body("status")
      .optional()
      .isIn(["AVAILABLE", "OCCUPIED", "RESERVED", "MAINTENANCE", "available", "occupied", "reserved", "maintenance"])
      .withMessage("Status is invalid"),
    body("description")
      .optional()
      .isLength({ max: 500 })
      .withMessage("Description must be less than 500 characters"),
  ],
  validate,
  createTable
);

router.put(
  "/:id",
  [
    param("id").isMongoId().withMessage("Invalid table id"),
    body("tableNumber").optional().trim().notEmpty().withMessage("Table number is required"),
    body("capacity").custom(validateOptionalCapacity),
    body("floor").custom(validateOptionalFloor),
    body("section").optional().trim().notEmpty().withMessage("Section is required"),
    body("shape").custom(validateOptionalShape),
    body("status")
      .optional()
      .isIn(["AVAILABLE", "OCCUPIED", "RESERVED", "MAINTENANCE", "available", "occupied", "reserved", "maintenance"])
      .withMessage("Status is invalid"),
    body("description")
      .optional()
      .isLength({ max: 500 })
      .withMessage("Description must be less than 500 characters"),
  ],
  validate,
  updateTable
);

router.delete("/:id", [param("id").isMongoId().withMessage("Invalid table id")], validate, deleteTable);

router.patch(
  "/:id/status",
  [
    param("id").isMongoId().withMessage("Invalid table id"),
    body("status")
      .isIn(["AVAILABLE", "OCCUPIED", "RESERVED", "MAINTENANCE", "available", "occupied", "reserved", "maintenance"])
      .withMessage("Status is invalid"),
  ],
  validate,
  updateTableStatus
);

router.get(
  "/:id/qr",
  [param("id").isMongoId().withMessage("Invalid table id")],
  validate,
  asyncHandler(async (req, res) => {
    const table = await Table.findOne(await buildRestaurantQuery({ _id: req.params.id }, req.user));
    if (!table) throw new ApiError(404, "Table not found");

    const frontendUrl = process.env.CLIENT_URL?.split(",")[0]?.trim() || "http://localhost:5173";
    const qrToken = createPublicMenuContext(table);
    const qrData = `${frontendUrl}/menu?qr=${encodeURIComponent(qrToken)}`;

    try {
      const qrCode = await QRCode.toDataURL(qrData, {
        width: 600,
        margin: 2,
        errorCorrectionLevel: "M",
      });

      res.setHeader("Cache-Control", "no-store");
      res.status(200).json({ qrCode, qrData });
    } catch (qrError) {
      throw new ApiError(500, "Failed to generate QR code");
    }
  })
);

export default router;
