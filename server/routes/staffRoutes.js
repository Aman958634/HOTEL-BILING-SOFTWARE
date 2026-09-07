import { Router } from "express";
import { body } from "express-validator";
import { authorize, protect, requirePermission } from "../middleware/auth.js";
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

router.get("/stats", requirePermission("staff.view"), getStaffStats);
router.get("/command-center", requirePermission("staff.view"), getStaffCommandCenter);
router.get("/active", requirePermission("staff.view"), getActiveStaff);
router.get("/by-role/:role", staffRoleValidation, validate, requirePermission("staff.view"), getStaffByRole);
router.get("/me", getMyStaffProfile);
router.get("/", staffListValidation, validate, requirePermission("staff.view"), listStaff);
router.get("/:id", staffIdValidation, validate, getStaffById);

router.post(
  "/",
  staffCreateValidation,
  validate,
  requirePermission("staff.manage"),
  createStaff
);

router.put(
  "/:id",
  staffUpdateValidation,
  validate,
  requirePermission("staff.manage"),
  updateStaff
);

router.patch(
  "/:id/status",
  staffStatusValidation,
  validate,
  requirePermission("staff.manage"),
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

router.delete("/:id", staffDeleteValidation, validate, requirePermission("staff.manage"), deleteStaff);

export default router;
