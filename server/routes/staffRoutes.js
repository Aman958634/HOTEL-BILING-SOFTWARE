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
  getStaffCommandCenter,
  updateDutyStatus,
  assignStaffWork,
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
router.get("/command-center", authorize("admin", "manager"), getStaffCommandCenter);
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

router.patch(
  "/:id/duty",
  [body("action").isIn(["START_SHIFT", "END_SHIFT", "START_BREAK", "END_BREAK"]).withMessage("Invalid duty action")],
  validate,
  updateDutyStatus
);

router.post(
  "/assignments",
  [body("type").isIn(["TABLE", "ORDER", "KOT", "DELIVERY"]), body("staffId").isMongoId(), body("entityId").isMongoId()],
  validate,
  assignStaffWork
);

router.delete("/:id", staffDeleteValidation, validate, authorize("admin"), deleteStaff);

export default router;
