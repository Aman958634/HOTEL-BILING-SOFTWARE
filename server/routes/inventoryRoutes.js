import { Router } from "express";
import { body, param } from "express-validator";
import authMiddleware from "../middleware/authMiddleware.js";
import { requireActiveSubscription } from "../middleware/subscriptionMiddleware.js";
import { requireRole } from "../middleware/roleMiddleware.js";
import { validate } from "../middleware/validate.js";
import {
  adjustInventory,
  createInventoryItem,
  createRecipe,
  listInventory,
  listMovements,
  listRecipes,
  recipeCost,
  updateInventoryItem,
  receiveStock,
  recordWastage,
  updateRecipeStatus,
} from "../controllers/inventoryController.js";

const managers = ["admin", "manager", "inventory_manager"];
const objectId = (name) => param(name).isMongoId().withMessage(`${name} is invalid`);

const router = Router();
router.use(authMiddleware, requireActiveSubscription);
router.get("/items", listInventory);
router.post("/items", requireRole(...managers), [body("itemName").trim().notEmpty(), body("sku").trim().notEmpty(), body("unit").trim().notEmpty(), body("quantity").optional().isFloat({ min: 0 })], validate, createInventoryItem);
router.put("/items/:id", requireRole(...managers), [objectId("id")], validate, updateInventoryItem);
router.get("/items/:id/movements", [objectId("id")], validate, listMovements);
router.post("/items/:id/adjust", requireRole(...managers), [objectId("id"), body("quantity").isFloat().not().equals("0"), body("unit").optional().isString(), body("reason").trim().notEmpty()], validate, adjustInventory);
router.post("/items/:id/receive", requireRole(...managers), [objectId("id"), body("quantity").isFloat({ min: 0.000001 }), body("unit").optional().isString()], validate, receiveStock);
router.post("/items/:id/wastage", requireRole(...managers), [objectId("id"), body("quantity").isFloat({ min: 0.000001 }), body("unit").optional().isString()], validate, recordWastage);
router.get("/recipes", listRecipes);
router.post("/recipes", requireRole(...managers), [body("food").isMongoId(), body("ingredients").isArray({ min: 1 })], validate, createRecipe);
router.get("/recipes/:id/cost", [objectId("id")], validate, recipeCost);
router.patch("/recipes/:id/status", requireRole(...managers), [objectId("id"), body("status").isIn(["DRAFT", "ACTIVE", "INACTIVE"])], validate, updateRecipeStatus);

export default router;
