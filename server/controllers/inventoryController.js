import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import Inventory from "../models/Inventory.js";
import StockMovement from "../models/StockMovement.js";
import Recipe from "../models/Recipe.js";
import Food from "../models/Food.js";
import { buildRestaurantQuery } from "../utils/tenantUtils.js";
import { calculateRecipeCost, inventoryStatus, recordStockMovement, resolveRestaurantId } from "../services/inventoryService.js";

const toPositive = (value, field) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new ApiError(422, `${field} must be greater than zero`);
  return number;
};

export const listInventory = asyncHandler(async (req, res) => {
  const filter = await buildRestaurantQuery({ isActive: { $ne: false }, ...(req.query.search ? { itemName: { $regex: String(req.query.search).trim(), $options: "i" } } : {}) }, req.user);
  const items = await Inventory.find(filter).populate("supplier", "name phone").sort({ itemName: 1 }).lean();
  res.json(new ApiResponse(true, "Inventory fetched", items.map((item) => ({ ...item, status: inventoryStatus(item), stockValue: Number(item.quantity || 0) * Number(item.costPerUnit || 0) }))));
});

export const createInventoryItem = asyncHandler(async (req, res) => {
  const restaurant = resolveRestaurantId(req.user);
  const openingStock = Number(req.body.quantity || 0);
  const unit = String(req.body.unit || "kg").trim().toLowerCase();
  const baseUnit = String(req.body.baseUnit || unit).trim().toLowerCase();
  
  // Validate that unit and baseUnit don't contain numbers
  if (/\d/.test(unit)) {
    throw new ApiError(422, "Unit cannot contain numbers. Store quantity separately from unit (e.g., quantity: 10, unit: 'kg')");
  }
  if (/\d/.test(baseUnit)) {
    throw new ApiError(422, "Base unit cannot contain numbers. Store quantity separately from unit (e.g., quantity: 10, unit: 'kg')");
  }
  
  const item = await Inventory.create({ 
    ...req.body, 
    restaurant, 
    outlet: req.outletId,
    itemName: String(req.body.itemName || "").trim(), 
    sku: String(req.body.sku || "").trim(), 
    unit,
    baseUnit,
    quantity: 0 
  });
  if (openingStock > 0) await recordStockMovement({ restaurant, inventoryItem: item._id, movementType: "OPENING_STOCK", quantity: openingStock, unit: item.unit, referenceType: "INVENTORY_ITEM", referenceId: item._id, reason: "Opening stock", user: req.user._id });
  res.status(201).json(new ApiResponse(true, "Inventory item created", item));
});

export const updateInventoryItem = asyncHandler(async (req, res) => {
  const filter = await buildRestaurantQuery({ _id: req.params.id }, req.user);
  
  // Validate and normalize unit fields if provided
  const updateData = { ...req.body, quantity: undefined };
  if (updateData.unit) {
    const unit = String(updateData.unit).trim().toLowerCase();
    if (/\d/.test(unit)) {
      throw new ApiError(422, "Unit cannot contain numbers. Store quantity separately from unit");
    }
    updateData.unit = unit;
  }
  if (updateData.baseUnit) {
    const baseUnit = String(updateData.baseUnit).trim().toLowerCase();
    if (/\d/.test(baseUnit)) {
      throw new ApiError(422, "Base unit cannot contain numbers. Store quantity separately from unit");
    }
    updateData.baseUnit = baseUnit;
  }
  
  const item = await Inventory.findOneAndUpdate(filter, { $set: updateData }, { new: true, runValidators: true });
  if (!item) throw new ApiError(404, "Inventory item not found");
  res.json(new ApiResponse(true, "Inventory item updated", item));
});

export const listMovements = asyncHandler(async (req, res) => {
  const filter = await buildRestaurantQuery({ inventoryItem: req.params.id }, req.user);
  const movements = await StockMovement.find(filter).sort({ createdAt: -1 }).limit(200).populate("user", "fullName email").lean();
  res.json(new ApiResponse(true, "Stock movements fetched", movements));
});

export const adjustInventory = asyncHandler(async (req, res) => {
  const restaurant = resolveRestaurantId(req.user);
  const movement = await recordStockMovement({ restaurant, inventoryItem: req.params.id, movementType: "ADJUSTMENT", quantity: toPositive(Math.abs(req.body.quantity), "Adjustment quantity"), unit: req.body.unit, referenceType: "ADJUSTMENT", referenceId: new mongoose.Types.ObjectId(), reason: req.body.reason || "Stock adjustment", user: req.user._id, metadata: { direction: Number(req.body.quantity) >= 0 ? "IN" : "OUT" } });
  res.json(new ApiResponse(true, "Stock adjusted", movement));
});

export const receiveStock = asyncHandler(async (req, res) => {
  const restaurant = resolveRestaurantId(req.user);
  const movement = await recordStockMovement({
    restaurant,
    inventoryItem: req.params.id,
    movementType: "PURCHASE",
    quantity: toPositive(req.body.quantity, "Quantity"),
    unit: req.body.unit,
    referenceType: "PURCHASE",
    referenceId: req.body.referenceId || "",
    reason: req.body.reason || "Stock received",
    user: req.user._id,
    metadata: { supplier: req.body.supplier || null, invoice: req.body.invoice || "" },
  });
  res.status(201).json(new ApiResponse(true, "Stock received", movement));
});

export const recordWastage = asyncHandler(async (req, res) => {
  const restaurant = resolveRestaurantId(req.user);
  const movement = await recordStockMovement({
    restaurant,
    inventoryItem: req.params.id,
    movementType: "WASTAGE",
    quantity: toPositive(req.body.quantity, "Quantity"),
    unit: req.body.unit,
    referenceType: "WASTAGE",
    referenceId: req.body.referenceId || "",
    reason: req.body.reason || "Wastage",
    user: req.user._id,
  });
  res.status(201).json(new ApiResponse(true, "Wastage recorded", movement));
});

export const updateRecipeStatus = asyncHandler(async (req, res) => {
  const restaurant = resolveRestaurantId(req.user);
  const status = String(req.body.status || "").toUpperCase();
  if (!["DRAFT", "ACTIVE", "INACTIVE"].includes(status)) throw new ApiError(422, "Invalid recipe status");
  const recipe = await Recipe.findOne({ _id: req.params.id, restaurant });
  if (!recipe) throw new ApiError(404, "Recipe not found");
  if (status === "ACTIVE") await Recipe.updateMany({ restaurant, food: recipe.food, status: "ACTIVE", _id: { $ne: recipe._id } }, { $set: { status: "INACTIVE" } });
  recipe.status = status;
  recipe.updatedBy = req.user._id;
  await recipe.save();
  res.json(new ApiResponse(true, "Recipe status updated", recipe));
});

export const listRecipes = asyncHandler(async (req, res) => {
  const filter = await buildRestaurantQuery({}, req.user);
  const recipes = await Recipe.find(filter).populate("food", "name price").populate("ingredients.inventoryItem", "itemName unit baseUnit costPerUnit").sort({ updatedAt: -1 }).lean();
  res.json(new ApiResponse(true, "Recipes fetched", recipes));
});

export const createRecipe = asyncHandler(async (req, res) => {
  const restaurant = resolveRestaurantId(req.user);
  if (!mongoose.isValidObjectId(req.body.food)) throw new ApiError(422, "Menu item is required");
  const food = await Food.findOne({ _id: req.body.food, restaurant });
  if (!food) throw new ApiError(404, "Menu item not found");
  const ingredients = Array.isArray(req.body.ingredients) ? req.body.ingredients : [];
  if (!ingredients.length) throw new ApiError(422, "Recipe requires at least one ingredient");
  const duplicateIds = ingredients.map((line) => String(line.inventoryItem));
  if (new Set(duplicateIds).size !== duplicateIds.length) throw new ApiError(422, "Recipe contains duplicate ingredients");
  if (String(req.body.status || "DRAFT").toUpperCase() === "ACTIVE") {
    await Recipe.updateMany({ restaurant, food: food._id, status: "ACTIVE" }, { $set: { status: "INACTIVE" } });
  }
  const latest = await Recipe.findOne({ restaurant, food: food._id }).sort({ version: -1 }).select("version").lean();
  const recipe = await Recipe.create({ ...req.body, restaurant, food: food._id, version: Number(req.body.version || (latest?.version || 0) + 1), createdBy: req.user._id, updatedBy: req.user._id });
  res.status(201).json(new ApiResponse(true, "Recipe created", { recipe, costing: await calculateRecipeCost(recipe) }));
});

export const recipeCost = asyncHandler(async (req, res) => {
  const recipe = await Recipe.findOne(await buildRestaurantQuery({ _id: req.params.id }, req.user));
  if (!recipe) throw new ApiError(404, "Recipe not found");
  res.json(new ApiResponse(true, "Recipe costing fetched", await calculateRecipeCost(recipe)));
});
