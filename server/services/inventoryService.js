import mongoose from "mongoose";
import Inventory from "../models/Inventory.js";
import StockMovement from "../models/StockMovement.js";
import Recipe from "../models/Recipe.js";
import Food from "../models/Food.js";
import ApiError from "../utils/ApiError.js";
import { convertQuantity } from "../utils/inventoryUnits.js";
import { runInTransaction } from "./transactionService.js";

const money = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export const resolveRestaurantId = (user) => {
  if (!user?.restaurant || !mongoose.isValidObjectId(user.restaurant)) {
    throw new ApiError(403, "Restaurant context required");
  }
  return user.restaurant;
};

export const inventoryStatus = (item) => {
  const stock = Number(item.quantity || 0);
  const reorder = Number(item.reorderLevel || 0);
  if (stock <= 0) return "OUT_OF_STOCK";
  if (stock <= Math.min(reorder, Number(item.minStock || reorder))) return "CRITICAL";
  if (stock <= reorder) return "LOW";
  return "NORMAL";
};

export const calculateRecipeCost = async (recipe, session = null) => {
  const ids = (recipe.ingredients || []).map((line) => line.inventoryItem);
  let inventoryQuery = Inventory.find({ _id: { $in: ids }, restaurant: recipe.restaurant });
  if (session) inventoryQuery = inventoryQuery.session(session);
  const items = await inventoryQuery.lean();
  const byId = new Map(items.map((item) => [String(item._id), item]));
  const lines = (recipe.ingredients || []).map((line) => {
    const item = byId.get(String(line.inventoryItem));
    if (!item) throw new ApiError(404, "Recipe ingredient inventory item not found");
    
    // Ensure baseUnit is set
    const targetUnit = item.baseUnit || item.unit || "kg";
    const quantity = convertQuantity(line.quantity, line.unit, targetUnit);
    
    if (quantity === null) {
      const errorMsg = `Cannot convert recipe ingredient from "${line.unit}" to inventory item unit "${targetUnit}" for ${item.itemName} (SKU: ${item.sku}). ` +
        `Ensure recipe unit is compatible with inventory unit and no numbers are stored in the unit field.`;
      throw new ApiError(422, errorMsg);
    }
    return { ...line, inventoryItem: item, baseQuantity: quantity, unitCost: Number(item.costPerUnit || 0), lineCost: money(quantity * Number(item.costPerUnit || 0)) };
  });
  const ingredientCost = money(lines.reduce((sum, line) => sum + line.lineCost, 0));
  const wastage = money(ingredientCost * Number(recipe.wastagePercent || 0) / 100);
  const totalCost = money(ingredientCost + wastage);
  return { lines, ingredientCost, wastage, totalCost, costPerPortion: money(totalCost / Math.max(1, Number(recipe.yieldQuantity || 1))) };
};

export const recordStockMovement = async ({ restaurant, inventoryItem, movementType, quantity, unit, referenceType = "", referenceId = "", idempotencyKey = "", reason = "", user = null, metadata = {}, session = null }) => {
  if (!session) {
    return runInTransaction((transactionSession) => recordStockMovement({
      restaurant, inventoryItem, movementType, quantity, unit, referenceType, referenceId,
      idempotencyKey, reason, user, metadata, session: transactionSession,
    }));
  }
  const item = await Inventory.findOne({ _id: inventoryItem, restaurant }).session(session);
  if (!item) throw new ApiError(404, "Inventory item not found");
  const baseUnit = item.baseUnit || item.unit;
  const baseQuantity = convertQuantity(quantity, unit || baseUnit, baseUnit);
  if (baseQuantity === null || baseQuantity <= 0) throw new ApiError(422, "Quantity must be a positive compatible amount");

  if (idempotencyKey) {
    const existing = await StockMovement.findOne({ restaurant, idempotencyKey }).session(session);
    if (existing) return existing;
  }

  const signedQuantity = movementType === "ADJUSTMENT"
    ? (metadata.direction === "IN" ? baseQuantity : -baseQuantity)
    : ["PURCHASE", "OPENING_STOCK", "TRANSFER_IN", "RETURN"].includes(movementType) ? baseQuantity : -baseQuantity;
  const previousStock = Number(item.quantity || 0);
  const newStock = money(previousStock + signedQuantity);
  if (newStock < 0) throw new ApiError(409, `Insufficient stock for ${item.itemName}`);

  const updated = await Inventory.findOneAndUpdate(
    { _id: item._id, restaurant, quantity: previousStock },
    { $set: { quantity: newStock } },
    { new: true, session }
  );
  if (!updated) throw new ApiError(409, "Stock changed concurrently. Please retry.");

  try {
    const [movement] = await StockMovement.create([{ restaurant, inventoryItem: item._id, movementType, quantity: signedQuantity, unit: baseUnit, previousStock, newStock, referenceType, referenceId: String(referenceId || ""), idempotencyKey, reason, user, metadata }], { session });
    return movement;
  } catch (error) {
    if (error?.code === 11000 && idempotencyKey) return StockMovement.findOne({ restaurant, idempotencyKey }).session(session);
    throw error;
  }
};

export const consumeOrderInventory = async ({ order, user = null, itemIndexes = null }) => {
  if (!order?.restaurant) return { consumed: 0, skipped: true };
  return runInTransaction(async (session) => {
    let consumed = 0;
    const selectedIndexes = itemIndexes ? new Set(itemIndexes.map((index) => Number(index))) : null;
    for (const [itemIndex, orderItem] of (order.items || []).entries()) {
      if (selectedIndexes && !selectedIndexes.has(itemIndex)) continue;
      const recipe = await Recipe.findOne({ restaurant: order.restaurant, food: orderItem.menuItem, status: "ACTIVE" }).sort({ version: -1 }).session(session);
      if (!recipe) continue;
      const costing = await calculateRecipeCost(recipe, session);
      const multiplier = Number(orderItem.quantity || 0) / Math.max(1, Number(recipe.yieldQuantity || 1));
      for (const line of costing.lines) {
        await recordStockMovement({ restaurant: order.restaurant, inventoryItem: line.inventoryItem._id, movementType: "CONSUMPTION", quantity: line.baseQuantity * multiplier, unit: line.inventoryItem.baseUnit || line.inventoryItem.unit, referenceType: "ORDER_ITEM", referenceId: `${order._id}:${itemIndex}`, idempotencyKey: `consumption:${order._id}:${itemIndex}:recipe-${recipe.version}:ingredient-${line.inventoryItem._id}`, reason: `Order ${order.orderNumber}`, user, metadata: { orderId: String(order._id), recipeId: String(recipe._id), recipeVersion: recipe.version }, session });
        consumed += 1;
      }
    }
    return { consumed, skipped: false };
  });
};

export { money };
