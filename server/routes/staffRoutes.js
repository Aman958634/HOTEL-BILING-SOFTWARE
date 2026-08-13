import { Router } from "express";
import { body } from "express-validator";
import { authorize, protect } from "../middleware/auth.js";
import { requireActiveSubscription } from "../middleware/subscriptionMiddleware.js";
import { validate } from "../middleware/validate.js";
import {
  deleteStaff,
  getActiveStaff,
  getMyStaffProfile,
  getStaffById,
  getStaffByRole,
  getStaffStats,
  listStaff,
  createStaff,
  updateStaff,
  updateStaffStatus,
} from "../controllers/staffController.js";
import {
  staffCreateValidation,
  staffDeleteValidation,
  staffIdValidation,
  staffListValidation,
  staffRoleValidation,
  staffStatusValidation,
  staffUpdateValidation,
} from "../validators/staffValidator.js";

const router = Router();

router.use(protect, requireActiveSubscription);

router.get("/stats", authorize("admin", "manager"), getStaffStats);
router.get("/active", authorize("admin", "manager"), getActiveStaff);
router.get("/by-role/:role", staffRoleValidation, validate, authorize("admin", "manager"), getStaffByRole);
router.get("/me", getMyStaffProfile);
router.get("/", staffListValidation, validate, authorize("admin", "manager"), listStaff);
router.get("/:id", staffIdValidation, validate, getStaffById);

router.post(
  "/",
  staffCreateValidation,
  validate,
  authorize("admin", "manager"),
  createStaff
);

router.put(
  "/:id",
  staffUpdateValidation,
  validate,
  authorize("admin", "manager"),
  updateStaff
);

router.patch(
  "/:id/status",
  staffStatusValidation,
  validate,
  authorize("admin", "manager"),
  updateStaffStatus
);

router.delete("/:id", staffDeleteValidation, validate, authorize("admin"), deleteStaff);

export default router;