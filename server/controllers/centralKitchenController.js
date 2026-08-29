import mongoose from "mongoose";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import CentralKitchen from "../models/CentralKitchen.js";
import CentralKitchenRequisition from "../models/CentralKitchenRequisition.js";
import CentralKitchenTransfer from "../models/CentralKitchenTransfer.js";
import ProductionBatch from "../models/ProductionBatch.js";
import Inventory from "../models/Inventory.js";
import { recordStockMovement } from "../services/inventoryService.js";
import { publishBusinessEvent, NOTIFICATION_EVENTS } from "../services/notificationService.js";
import { CENTRAL_KITCHEN_MANAGERS, canManageCentralKitchen, createRequisition, approveRequisition, rejectRequisition, cancelRequisition, createBatch, startBatch, completeBatch, createTransfer, dispatchTransfer, cancelTransfer, receiveTransfer, scopeCentralKitchenList } from "../services/centralKitchenService.js";

const restaurantOf = (user) => {
  if (!user?.restaurant) throw new ApiError(403, "Restaurant context required");
  return user.restaurant;
};
const pageOptions = (query) => ({ page: Math.max(Number(query.page) || 1, 1), limit: Math.min(Math.max(Number(query.limit) || 20, 1), 100) });
const paged = async (model, filter, query, populate) => {
  const { page, limit } = pageOptions(query);
  const [rows, total] = await Promise.all([model.find(filter).populate(populate).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), model.countDocuments(filter)]);
  return { rows, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};
const outletName = (row) => row.outlet?.name || "the outlet";

export const listKitchens = asyncHandler(async (req, res) => {
  const rows = await CentralKitchen.find({ restaurant: restaurantOf(req.user) }).sort({ isActive: -1, name: 1 }).lean();
  res.json(new ApiResponse(true, "Central kitchens fetched", rows));
});

export const createKitchen = asyncHandler(async (req, res) => {
  if (!canManageCentralKitchen(req.user)) throw new ApiError(403, "You are not allowed to manage central kitchens");
  const kitchen = await CentralKitchen.create({ restaurant: restaurantOf(req.user), name: String(req.body.name || "").trim(), code: String(req.body.code || "").trim().toUpperCase(), address: String(req.body.address || "").trim(), timezone: String(req.body.timezone || "Asia/Kolkata").trim(), contactPhone: String(req.body.contactPhone || "").trim() });
  res.status(201).json(new ApiResponse(true, "Central kitchen created", kitchen));
});

export const updateKitchenStatus = asyncHandler(async (req, res) => {
  if (!canManageCentralKitchen(req.user)) throw new ApiError(403, "You are not allowed to manage central kitchens");
  const kitchen = await CentralKitchen.findOneAndUpdate({ _id: req.params.id, restaurant: restaurantOf(req.user) }, { $set: { isActive: Boolean(req.body.isActive) } }, { new: true });
  if (!kitchen) throw new ApiError(404, "Central kitchen not found");
  res.json(new ApiResponse(true, "Central kitchen updated", kitchen));
});

export const listCentralInventory = asyncHandler(async (req, res) => {
  const restaurant = restaurantOf(req.user);
  if (!canManageCentralKitchen(req.user) && !req.user.activeOutlet) throw new ApiError(403, "Outlet context required");
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(422, "Central kitchen is invalid");
  const kitchen = await CentralKitchen.findOne({ _id: req.params.id, restaurant, isActive: true });
  if (!kitchen) throw new ApiError(404, "Central kitchen not found");
  const items = await Inventory.find({ restaurant, centralKitchen: kitchen._id, outlet: null, isActive: { $ne: false } }).sort({ itemName: 1 }).lean();
  res.json(new ApiResponse(true, "Central kitchen inventory fetched", items));
});

export const createCentralInventory = asyncHandler(async (req, res) => {
  if (!canManageCentralKitchen(req.user)) throw new ApiError(403, "You are not allowed to manage central stock");
  const restaurant = restaurantOf(req.user);
  const kitchen = await CentralKitchen.findOne({ _id: req.params.id, restaurant, isActive: true });
  if (!kitchen) throw new ApiError(404, "Central kitchen not found");
  const unit = String(req.body.unit || "").trim().toLowerCase();
  const baseUnit = String(req.body.baseUnit || unit).trim().toLowerCase();
  if (!unit || /\d/.test(unit) || /\d/.test(baseUnit)) throw new ApiError(422, "A valid unit is required");
  const item = await Inventory.create({ restaurant, centralKitchen: kitchen._id, outlet: null, itemName: String(req.body.itemName || "").trim(), sku: String(req.body.sku || "").trim(), quantity: 0, unit, baseUnit, minStock: Number(req.body.minStock || 0), reorderLevel: Number(req.body.reorderLevel || 0), costPerUnit: Number(req.body.costPerUnit || 0), category: String(req.body.category || "Other").trim(), storageLocation: String(req.body.storageLocation || "").trim() });
  if (Number(req.body.quantity || 0) > 0) await recordStockMovement({ restaurant, centralKitchen: kitchen._id, inventoryItem: item._id, movementType: "OPENING_STOCK", quantity: Number(req.body.quantity), unit, referenceType: "INVENTORY_ITEM", referenceId: item._id, reason: "Central kitchen opening stock", user: req.user._id });
  res.status(201).json(new ApiResponse(true, "Central kitchen inventory item created", item));
});

export const adjustCentralInventory = asyncHandler(async (req, res) => {
  if (!canManageCentralKitchen(req.user)) throw new ApiError(403, "You are not allowed to adjust central stock");
  const restaurant = restaurantOf(req.user);
  const kitchen = await CentralKitchen.findOne({ _id: req.params.id, restaurant, isActive: true });
  if (!kitchen) throw new ApiError(404, "Central kitchen not found");
  const quantity = Number(req.body.quantity);
  if (!Number.isFinite(quantity) || quantity === 0) throw new ApiError(422, "Adjustment quantity cannot be zero");
  const movement = await recordStockMovement({ restaurant, centralKitchen: kitchen._id, inventoryItem: req.params.itemId, movementType: "ADJUSTMENT", quantity: Math.abs(quantity), unit: req.body.unit, referenceType: "CENTRAL_KITCHEN_ADJUSTMENT", referenceId: new mongoose.Types.ObjectId(), reason: String(req.body.reason || "").trim(), user: req.user._id, metadata: { direction: quantity > 0 ? "IN" : "OUT" } });
  res.json(new ApiResponse(true, "Central stock adjusted", movement));
});

export const recordCentralWastage = asyncHandler(async (req, res) => {
  if (!canManageCentralKitchen(req.user)) throw new ApiError(403, "You are not allowed to record central wastage");
  const restaurant = restaurantOf(req.user);
  const kitchen = await CentralKitchen.findOne({ _id: req.params.id, restaurant, isActive: true });
  if (!kitchen) throw new ApiError(404, "Central kitchen not found");
  const quantity = Number(req.body.quantity);
  if (!Number.isFinite(quantity) || quantity <= 0) throw new ApiError(422, "Wastage quantity must be greater than zero");
  const movement = await recordStockMovement({ restaurant, centralKitchen: kitchen._id, inventoryItem: req.params.itemId, movementType: "WASTAGE", quantity, unit: req.body.unit, referenceType: "CENTRAL_KITCHEN_WASTAGE", referenceId: new mongoose.Types.ObjectId(), reason: String(req.body.reason || "Wastage").trim(), user: req.user._id });
  res.json(new ApiResponse(true, "Central wastage recorded", movement));
});

export const listRequisitions = asyncHandler(async (req, res) => {
  const filter = scopeCentralKitchenList({ user: req.user, query: req.query });
  const result = await paged(CentralKitchenRequisition, filter, req.query, [{ path: "outlet", select: "name code" }, { path: "centralKitchen", select: "name code" }, { path: "requestedBy", select: "fullName" }, { path: "items.centralInventoryItem", select: "itemName sku unit" }]);
  res.json(new ApiResponse(true, "Requisitions fetched", result));
});

export const createRequisitionController = asyncHandler(async (req, res) => {
  const requisition = await createRequisition({ user: req.user, centralKitchen: req.body.centralKitchen, items: req.body.items, notes: req.body.notes });
  const populated = await requisition.populate([{ path: "outlet", select: "name" }, { path: "centralKitchen", select: "name" }]);
  await publishBusinessEvent({ eventType: NOTIFICATION_EVENTS.CENTRAL_KITCHEN_REQUISITION_CREATED, restaurantId: requisition.restaurant, entityType: "CentralKitchenRequisition", entityId: requisition._id, actorUserId: req.user._id, payload: { requisitionNumber: requisition.requisitionNumber, outletName: outletName(populated) } });
  res.status(201).json(new ApiResponse(true, "Requisition submitted", populated));
});

export const approveRequisitionController = asyncHandler(async (req, res) => {
  const requisition = await approveRequisition({ user: req.user, requisitionId: req.params.id, lines: req.body.items });
  await publishBusinessEvent({ eventType: NOTIFICATION_EVENTS.CENTRAL_KITCHEN_REQUISITION_APPROVED, restaurantId: requisition.restaurant, outletId: requisition.outlet, entityType: "CentralKitchenRequisition", entityId: requisition._id, actorUserId: req.user._id, payload: { requisitionNumber: requisition.requisitionNumber } });
  res.json(new ApiResponse(true, "Requisition approved", requisition));
});

export const rejectRequisitionController = asyncHandler(async (req, res) => {
  const requisition = await rejectRequisition({ user: req.user, requisitionId: req.params.id, reason: req.body.reason });
  await publishBusinessEvent({ eventType: NOTIFICATION_EVENTS.CENTRAL_KITCHEN_REQUISITION_REJECTED, restaurantId: requisition.restaurant, outletId: requisition.outlet, entityType: "CentralKitchenRequisition", entityId: requisition._id, actorUserId: req.user._id, payload: { requisitionNumber: requisition.requisitionNumber } });
  res.json(new ApiResponse(true, "Requisition rejected", requisition));
});
export const cancelRequisitionController = asyncHandler(async (req, res) => res.json(new ApiResponse(true, "Requisition cancelled", await cancelRequisition({ user: req.user, requisitionId: req.params.id }))));

export const listBatches = asyncHandler(async (req, res) => {
  if (!canManageCentralKitchen(req.user)) throw new ApiError(403, "You are not allowed to view production");
  const filter = { restaurant: restaurantOf(req.user), ...(req.query.centralKitchen && mongoose.isValidObjectId(req.query.centralKitchen) ? { centralKitchen: req.query.centralKitchen } : {}), ...(req.query.status ? { status: req.query.status } : {}) };
  const result = await paged(ProductionBatch, filter, req.query, [{ path: "centralKitchen", select: "name code" }, { path: "recipe", select: "name version" }, { path: "outputInventoryItem", select: "itemName sku unit" }]);
  res.json(new ApiResponse(true, "Production batches fetched", result));
});

export const createBatchController = asyncHandler(async (req, res) => {
  const batch = await createBatch({ user: req.user, centralKitchen: req.body.centralKitchen, recipeId: req.body.recipeId, outputInventoryItem: req.body.outputInventoryItem, plannedQty: req.body.plannedQty, unit: req.body.unit, notes: req.body.notes, expiryDate: req.body.expiryDate });
  res.status(201).json(new ApiResponse(true, "Production batch planned", batch));
});
export const startBatchController = asyncHandler(async (req, res) => res.json(new ApiResponse(true, "Production batch started", await startBatch({ user: req.user, batchId: req.params.id }))));
export const completeBatchController = asyncHandler(async (req, res) => {
  const batch = await completeBatch({ user: req.user, batchId: req.params.id, actualQty: req.body.actualQty, unit: req.body.unit, productionLossQty: req.body.productionLossQty, lossReason: req.body.lossReason });
  await publishBusinessEvent({ eventType: NOTIFICATION_EVENTS.CENTRAL_KITCHEN_BATCH_COMPLETED, restaurantId: batch.restaurant, entityType: "ProductionBatch", entityId: batch._id, actorUserId: req.user._id, payload: { batchNumber: batch.batchNumber } });
  res.json(new ApiResponse(true, "Production batch completed", batch));
});

export const listTransfers = asyncHandler(async (req, res) => {
  const restaurant = restaurantOf(req.user);
  const filter = { restaurant, ...(req.query.centralKitchen && mongoose.isValidObjectId(req.query.centralKitchen) ? { centralKitchen: req.query.centralKitchen } : {}), ...(req.query.status ? { status: req.query.status } : {}) };
  if (!canManageCentralKitchen(req.user)) filter.destinationOutlet = req.user.activeOutlet;
  else if (req.query.outlet && mongoose.isValidObjectId(req.query.outlet)) filter.destinationOutlet = req.query.outlet;
  const result = await paged(CentralKitchenTransfer, filter, req.query, [{ path: "centralKitchen", select: "name code" }, { path: "destinationOutlet", select: "name code" }, { path: "requisition", select: "requisitionNumber status" }, { path: "items.centralInventoryItem", select: "itemName sku unit" }]);
  res.json(new ApiResponse(true, "Transfers fetched", result));
});

export const createTransferController = asyncHandler(async (req, res) => res.status(201).json(new ApiResponse(true, "Transfer created", await createTransfer({ user: req.user, centralKitchen: req.body.centralKitchen, destinationOutlet: req.body.destinationOutlet, requisitionId: req.body.requisitionId, items: req.body.items, notes: req.body.notes }))));
export const dispatchTransferController = asyncHandler(async (req, res) => {
  const transfer = await dispatchTransfer({ user: req.user, transferId: req.params.id, idempotencyKey: req.get("Idempotency-Key") || req.body.idempotencyKey });
  await publishBusinessEvent({ eventType: NOTIFICATION_EVENTS.CENTRAL_KITCHEN_TRANSFER_DISPATCHED, restaurantId: transfer.restaurant, outletId: transfer.destinationOutlet, entityType: "CentralKitchenTransfer", entityId: transfer._id, actorUserId: req.user._id, payload: { transferNumber: transfer.transferNumber } });
  res.json(new ApiResponse(true, "Transfer dispatched", transfer));
});
export const cancelTransferController = asyncHandler(async (req, res) => res.json(new ApiResponse(true, "Transfer cancelled", await cancelTransfer({ user: req.user, transferId: req.params.id }))));
export const receiveTransferController = asyncHandler(async (req, res) => {
  const transfer = await receiveTransfer({ user: req.user, transferId: req.params.id, items: req.body.items, idempotencyKey: req.get("Idempotency-Key") || req.body.idempotencyKey, notes: req.body.notes });
  const eventType = transfer.status === "PARTIALLY_RECEIVED" ? NOTIFICATION_EVENTS.CENTRAL_KITCHEN_TRANSFER_DISCREPANCY : NOTIFICATION_EVENTS.CENTRAL_KITCHEN_TRANSFER_RECEIVED;
  await publishBusinessEvent({ eventType, restaurantId: transfer.restaurant, outletId: transfer.destinationOutlet, entityType: "CentralKitchenTransfer", entityId: transfer._id, actorUserId: req.user._id, payload: { transferNumber: transfer.transferNumber } });
  res.json(new ApiResponse(true, "Transfer receiving recorded", transfer));
});

export { CENTRAL_KITCHEN_MANAGERS };
