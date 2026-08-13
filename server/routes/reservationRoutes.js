import { Router } from "express";
import { createReservation, listReservations, updateReservationStatus } from "../controllers/reservationController.js";
import { authorize, protect } from "../middleware/auth.js";
import { requireActiveSubscription } from "../middleware/subscriptionMiddleware.js";

const router = Router();

router.post("/", protect, requireActiveSubscription, createReservation);
router.get("/", protect, requireActiveSubscription, listReservations);
router.patch("/:id/status", protect, requireActiveSubscription, authorize("admin", "manager", "waiter"), updateReservationStatus);

export default router;
