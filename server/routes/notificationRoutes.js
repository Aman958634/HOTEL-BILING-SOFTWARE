import { Router } from "express";
import { body, param, query } from "express-validator";
import {
  deleteNotification,
  getNotificationSummary,
  getNotifications,
  markAllNotificationsRead,
  updateNotificationStatus,
} from "../controllers/notificationController.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.get(
  "/",
  [
    query("page").optional().isInt({ min: 1 }).withMessage("Page must be at least 1"),
    query("limit").optional().isInt({ min: 1, max: 100 }).withMessage("Limit must be between 1 and 100"),
    query("sortBy").optional().isString().withMessage("sortBy must be a string"),
    query("sortOrder").optional().isIn(["asc", "desc"]).withMessage("sortOrder must be asc or desc"),
    query("type").optional().isString().withMessage("Type filter must be a string"),
    query("category").optional().isString().withMessage("Category filter must be a string"),
    query("severity").optional().isIn(["INFO", "SUCCESS", "WARNING", "CRITICAL"]).withMessage("Invalid severity"),
    query("dateFrom").optional().isISO8601().withMessage("dateFrom must be an ISO date"),
    query("dateTo").optional().isISO8601().withMessage("dateTo must be an ISO date"),
    query("isRead").optional().isBoolean().withMessage("isRead must be a boolean"),
  ],
  validate,
  getNotifications
);

router.get("/summary", getNotificationSummary);

router.patch(
  "/:id/read",
  [
    param("id").isMongoId().withMessage("Invalid notification id"),
    body("isRead").isBoolean().withMessage("isRead must be a boolean"),
  ],
  validate,
  updateNotificationStatus
);

router.patch("/read-all", markAllNotificationsRead);

router.delete(
  "/:id",
  [param("id").isMongoId().withMessage("Invalid notification id")],
  validate,
  deleteNotification
);

export default router;
