import { Router } from "express";
import { body, param, query } from "express-validator";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireActiveSubscription } from "../middleware/subscriptionMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { validate } from "../middleware/validate.js";
import {
  CENTRAL_KITCHEN_MANAGERS,
  listKitchens, createKitchen, updateKitchenStatus, listCentralInventory, createCentralInventory, adjustCentralInventory, recordCentralWastage,
  listRequisitions, createRequisitionController, approveRequisitionController, rejectRequisitionController, cancelRequisitionController,
  listBatches, createBatchController, startBatchController, completeBatchController,
  listTransfers, createTransferController, dispatchTransferController, cancelTransferController, receiveTransferController,
} from "../controllers/centralKitchenController.js";

const router = Router();
const id = (field) => param(field).isMongoId().withMessage(`${field} is invalid`);
const queryId = (field) => query(field).optional().isMongoId().withMessage(`${field} is invalid`);
const managers = [...CENTRAL_KITCHEN_MANAGERS];
const requisitionRequesters = [...managers, "manager", "inventory_manager"];

router.use(authMiddleware, requireActiveSubscription);
router.get("/", listKitchens);
router.post("/", requireRole(...managers), [body("name").trim().notEmpty(), body("code").trim().notEmpty()], validate, createKitchen);
router.patch("/:id/status", requireRole(...managers), [id("id"), body("isActive").isBoolean()], validate, updateKitchenStatus);
router.get("/:id/inventory", [id("id")], validate, listCentralInventory);
router.post("/:id/inventory", requireRole(...managers), [id("id"), body("itemName").trim().notEmpty(), body("sku").trim().notEmpty(), body("unit").trim().notEmpty(), body("quantity").optional().isFloat({ min: 0 })], validate, createCentralInventory);
router.post("/:id/inventory/:itemId/adjust", requireRole(...managers), [id("id"), param("itemId").isMongoId(), body("quantity").isFloat().not().equals("0"), body("reason").trim().notEmpty()], validate, adjustCentralInventory);
router.post("/:id/inventory/:itemId/wastage", requireRole(...managers), [id("id"), param("itemId").isMongoId(), body("quantity").isFloat({ min: 0.000001 }), body("reason").trim().notEmpty()], validate, recordCentralWastage);

router.get("/operations/requisitions", [queryId("centralKitchen"), queryId("outlet"), query("status").optional().isIn(["DRAFT", "SUBMITTED", "APPROVED", "PARTIALLY_APPROVED", "REJECTED", "PARTIALLY_DISPATCHED", "DISPATCHED", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"]), query("page").optional().isInt({ min: 1 }), query("limit").optional().isInt({ min: 1, max: 100 })], validate, listRequisitions);
router.post("/operations/requisitions", requireRole(...requisitionRequesters), [body("centralKitchen").isMongoId(), body("items").isArray({ min: 1 }), body("items.*.centralInventoryItem").isMongoId(), body("items.*.requestedQty").isFloat({ min: 0.000001 }), body("items.*.unit").optional().isString()], validate, createRequisitionController);
router.patch("/operations/requisitions/:id/approve", requireRole(...managers), [id("id"), body("items").isArray({ min: 1 }), body("items.*.approvedQty").isFloat({ min: 0 })], validate, approveRequisitionController);
router.patch("/operations/requisitions/:id/reject", requireRole(...managers), [id("id"), body("reason").trim().notEmpty()], validate, rejectRequisitionController);
router.patch("/operations/requisitions/:id/cancel", [id("id")], validate, cancelRequisitionController);

router.get("/operations/batches", requireRole(...managers), [queryId("centralKitchen"), query("status").optional().isIn(["PLANNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]), query("page").optional().isInt({ min: 1 }), query("limit").optional().isInt({ min: 1, max: 100 })], validate, listBatches);
router.post("/operations/batches", requireRole(...managers), [body("centralKitchen").isMongoId(), body("recipeId").isMongoId(), body("outputInventoryItem").isMongoId(), body("plannedQty").isFloat({ min: 0.000001 }), body("unit").trim().notEmpty()], validate, createBatchController);
router.patch("/operations/batches/:id/start", requireRole(...managers), [id("id")], validate, startBatchController);
router.patch("/operations/batches/:id/complete", requireRole(...managers), [id("id"), body("actualQty").isFloat({ min: 0.000001 }), body("unit").optional().isString(), body("productionLossQty").optional().isFloat({ min: 0 })], validate, completeBatchController);

router.get("/operations/transfers", [queryId("centralKitchen"), queryId("outlet"), query("status").optional().isIn(["READY", "DISPATCHED", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"]), query("page").optional().isInt({ min: 1 }), query("limit").optional().isInt({ min: 1, max: 100 })], validate, listTransfers);
router.post("/operations/transfers", requireRole(...managers), [body("centralKitchen").isMongoId(), body("destinationOutlet").isMongoId(), body("requisitionId").optional().isMongoId(), body("items").isArray({ min: 1 }), body("items.*.centralInventoryItem").isMongoId(), body("items.*.dispatchedQty").isFloat({ min: 0.000001 })], validate, createTransferController);
router.patch("/operations/transfers/:id/dispatch", requireRole(...managers), [id("id")], validate, dispatchTransferController);
router.patch("/operations/transfers/:id/cancel", requireRole(...managers), [id("id")], validate, cancelTransferController);
router.patch("/operations/transfers/:id/receive", [id("id"), body("items").isArray({ min: 1 }), body("items.*.transferItemId").isMongoId(), body("items.*.receivedQty").isFloat({ min: 0.000001 })], validate, receiveTransferController);

export default router;
