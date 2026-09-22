import { Router } from "express";
import { body, param } from "express-validator";
import { createReservation, listReservations, updateReservationStatus } from "../controllers/reservationController.js";
import { authorize, protect } from "../middleware/auth.js";
import { requireActiveSubscription } from "../middleware/subscriptionMiddleware.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.post("/", protect, requireActiveSubscription, [
  body("table").isMongoId().withMessage("Invalid table id"),
  body("date").isISO8601({ strict: true }).withMessage("Reservation date is invalid"),
  body("guests").isInt({ min: 1, max: 100 }).withMessage("Guest count must be between 1 and 100"),
  body("restaurant").optional({ values: "falsy" }).isMongoId().withMessage("Invalid restaurant id"),
  body("notes").optional({ values: "falsy" }).trim().isLength({ max: 1000 }).withMessage("Notes must be 1000 characters or fewer"),
], validate, createReservation);
router.get("/", protect, requireActiveSubscription, listReservations);
router.patch("/:id/status", protect, requireActiveSubscription, authorize("admin", "manager", "waiter"), [
  param("id").isMongoId().withMessage("Invalid reservation id"),
  body("status").isIn(["pending", "confirmed", "cancelled", "completed"]).withMessage("Invalid reservation status"),
], validate, updateReservationStatus);

export default router;
