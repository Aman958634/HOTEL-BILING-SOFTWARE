import express from "express";
import { protect, requirePermission } from "../middleware/auth.js";
import {
  getHotelPaymentSettings,
  saveHotelPaymentSettings,
  createHotelPaymentQr,
  verifyHotelPayment,
  rejectHotelPayment,
} from "../controllers/hotelPaymentController.js";

const router = express.Router();

router.use(protect);
router.get("/settings", requirePermission("payments.view"), getHotelPaymentSettings);
router.put("/settings", requirePermission("payments.collect"), saveHotelPaymentSettings);
router.post("/qr", requirePermission("payments.collect"), createHotelPaymentQr);
router.post("/verify", requirePermission("payments.collect"), verifyHotelPayment);
router.post("/reject", requirePermission("payments.collect"), rejectHotelPayment);

export default router;
