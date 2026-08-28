import { Router } from "express";
import { body, param, query } from "express-validator";
import mongoose from "mongoose";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireActiveSubscription } from "../middleware/subscriptionMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { validate } from "../middleware/validate.js";
import {
  bulkReadyKitchenItems,
  bulkServeKitchenItems,
  bulkStartKitchenItems,
  createKitchenStation,
  deleteKitchenStation,
  getKitchenTickets,
  listKitchenStations,
  updateKitchenItemStatus,
  updateKitchenStation,
} from "../controllers/kitchenController.js";

const router = Router();

router.use(authMiddleware, requireActiveSubscription);

router.get(
  "/tickets",
  [
    query("status").optional().isString().withMessage("Status must be a string"),
    query("station").optional().isString().withMessage("Station must be a string"),
    query("orderType").optional().isString().withMessage("Order type must be a string"),
    query("search").optional().isString().withMessage("Search must be a string"),
    query("limit").optional().isInt({ min: 1, max: 200 }).withMessage("Limit must be between 1 and 200"),
  ],
  validate,
  getKitchenTickets
);

router.patch(
  "/tickets/:orderId/items/:itemIndex",
  [
    param("orderId").isMongoId().withMessage("Invalid order id"),
    param("itemIndex").isInt({ min: 0 }).withMessage("Item index must be a non-negative integer"),
    body("kitchenStatus").notEmpty().withMessage("Kitchen status is required"),
  ],
  validate,
  updateKitchenItemStatus
);

router.patch(
  "/tickets/:orderId/start",
  [param("orderId").isMongoId().withMessage("Invalid order id")],
  validate,
  bulkStartKitchenItems
);

router.patch(
  "/tickets/:orderId/ready",
  [param("orderId").isMongoId().withMessage("Invalid order id")],
  validate,
  bulkReadyKitchenItems
);

router.patch(
  "/tickets/:orderId/serve",
  [param("orderId").isMongoId().withMessage("Invalid order id")],
  validate,
  bulkServeKitchenItems
);

router.get(
  "/stations",
  [query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100")],
  validate,
  listKitchenStations
);

router.post(
  "/stations",
  [
    body("name").trim().notEmpty().withMessage("Station name is required"),
    body("isActive").optional().isBoolean().withMessage("isActive must be a boolean"),
    body("sortOrder").optional().isInt({ min: 0 }).withMessage("sortOrder must be a non-negative integer"),
  ],
  validate,
  requireRole("admin", "manager"),
  createKitchenStation
);

router.put(
  "/stations/:id",
  [
    param("id").isMongoId().withMessage("Invalid station id"),
    body("name").optional().trim().notEmpty().withMessage("Station name cannot be empty"),
    body("isActive").optional().isBoolean().withMessage("isActive must be a boolean"),
    body("sortOrder").optional().isInt({ min: 0 }).withMessage("sortOrder must be a non-negative integer"),
  ],
  validate,
  requireRole("admin", "manager"),
  updateKitchenStation
);

router.delete(
  "/stations/:id",
  [param("id").isMongoId().withMessage("Invalid station id")],
  validate,
  requireRole("admin", "manager"),
  deleteKitchenStation
);

export default router;
