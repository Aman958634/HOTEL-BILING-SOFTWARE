import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";
import CentralKitchen from "../models/CentralKitchen.js";
import CentralKitchenRequisition from "../models/CentralKitchenRequisition.js";
import CentralKitchenTransfer from "../models/CentralKitchenTransfer.js";
import ProductionBatch from "../models/ProductionBatch.js";
import Inventory from "../models/Inventory.js";
import Recipe from "../models/Recipe.js";
import Outlet from "../models/Outlet.js";
import { convertQuantity } from "../utils/inventoryUnits.js";
import { recordStockMovement } from "./inventoryService.js";

// The current RBAC model has no separate central-kitchen assignment. Keep the
// cross-outlet operational controls tenant-admin-only until that permission is
// introduced; outlet staff retain their own request/receive boundary.
export const CENTRAL_KITCHEN_MANAGERS = ["admin", "restaurant_admin", "hotel_admin"];
export const canManageCentralKitchen = (user) => user?.role === "super_admin" || CENTRAL_KITCHEN_MANAGERS.includes(String(user?.role || "").toLowerCase());
const number = (value, name) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new ApiError(422, `${name} must be greater than zero`);
  return parsed;
};
const same = (left, right) => String(left || "") === String(right || "");
const reference = (prefix) => `${prefix}-${new Date().getFullYear()}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
const requireRestaurant = (user) => {
  if (!user?.restaurant || !mongoose.isValidObjectId(user.restaurant)) throw new ApiError(403, "Restaurant context required");
  return user.restaurant;
};
const requireOutlet = (user) => {
  if (!user?.activeOutlet || !mongoose.isValidObjectId(user.activeOutlet)) throw new ApiError(403, "An authorized outlet context is required");
  return user.activeOutlet;
};

export const getCentralKitchen = async ({ restaurant, centralKitchen, activeOnly = true, session = null }) => {
  if (!mongoose.isValidObjectId(centralKitchen)) throw new ApiError(422, "Central kitchen is invalid");
  const kitchen = await CentralKitchen.findOne({ _id: centralKitchen, restaurant, ...(activeOnly ? { isActive: true } : {}) }).session(session);
  if (!kitchen) throw new ApiError(404, "Central kitchen not found");
  return kitchen;
};

const normalizeCentralLines = async ({ restaurant, centralKitchen, lines, quantityKey, session = null }) => {
  if (!Array.isArray(lines) || !lines.length) throw new ApiError(422, "At least one inventory item is required");
  const ids = lines.map((line) => line.centralInventoryItem || line.inventoryItem);
  if (ids.some((id) => !mongoose.isValidObjectId(id))) throw new ApiError(422, "Inventory item is invalid");
  if (new Set(ids.map(String)).size !== ids.length) throw new ApiError(422, "Duplicate inventory items are not allowed");
  const inventory = await Inventory.find({ _id: { $in: ids }, restaurant, centralKitchen, outlet: null, isActive: { $ne: false } }).session(session).lean();
  if (inventory.length !== ids.length) throw new ApiError(422, "Each item must belong to the selected central kitchen");
  const byId = new Map(inventory.map((item) => [String(item._id), item]));
  return lines.map((line) => {
    const centralInventoryItem = line.centralInventoryItem || line.inventoryItem;
    const item = byId.get(String(centralInventoryItem));
    const rawQuantity = number(line[quantityKey], "Quantity");
    const unit = String(line.unit || item.baseUnit || item.unit).trim().toLowerCase();
    const converted = convertQuantity(rawQuantity, unit, item.baseUnit || item.unit);
    if (converted === null) throw new ApiError(422, `Incompatible unit for ${item.itemName}`);
    return { item, centralInventoryItem: item._id, quantity: converted, unit: item.baseUnit || item.unit };
  });
};

const updateRequisitionStatus = (requisition) => {
  const totals = requisition.items.reduce((result, item) => ({
    approved: result.approved + Number(item.approvedQty || 0),
    dispatched: result.dispatched + Number(item.dispatchedQty || 0),
    fulfilled: result.fulfilled + Number(item.fulfilledQty || 0),
  }), { approved: 0, dispatched: 0, fulfilled: 0 });
  if (totals.approved > 0 && totals.fulfilled >= totals.approved) return "RECEIVED";
  if (totals.fulfilled > 0) return "PARTIALLY_RECEIVED";
  if (totals.dispatched >= totals.approved && totals.approved > 0) return "DISPATCHED";
  if (totals.dispatched > 0) return "PARTIALLY_DISPATCHED";
  return requisition.items.every((item) => Number(item.approvedQty || 0) === Number(item.requestedQty || 0)) ? "APPROVED" : "PARTIALLY_APPROVED";
};

export const createRequisition = async ({ user, centralKitchen, items, notes = "" }) => {
  const restaurant = requireRestaurant(user);
  const outlet = requireOutlet(user);
  await getCentralKitchen({ restaurant, centralKitchen });
  const lines = await normalizeCentralLines({ restaurant, centralKitchen, lines: items, quantityKey: "requestedQty" });
  return CentralKitchenRequisition.create({ requisitionNumber: reference("REQ"), restaurant, centralKitchen, outlet, requestedBy: user._id, notes: String(notes || "").trim(), items: lines.map((line) => ({ centralInventoryItem: line.centralInventoryItem, requestedQty: line.quantity, unit: line.unit })), history: [{ action: "REQUISITION_CREATED", by: user._id }] });
};

export const approveRequisition = async ({ user, requisitionId, lines }) => {
  const restaurant = requireRestaurant(user);
  if (!canManageCentralKitchen(user)) throw new ApiError(403, "You are not allowed to approve requisitions");
  const requisition = await CentralKitchenRequisition.findOne({ _id: requisitionId, restaurant });
  if (!requisition) throw new ApiError(404, "Requisition not found");
  if (!["SUBMITTED", "PARTIALLY_APPROVED"].includes(requisition.status)) throw new ApiError(409, "Only submitted requisitions can be approved");
  const byId = new Map((lines || []).map((line) => [String(line.itemId || line._id || line.centralInventoryItem), line]));
  if (!byId.size) throw new ApiError(422, "Approval quantities are required");
  for (const item of requisition.items) {
    const line = byId.get(String(item._id)) || byId.get(String(item.centralInventoryItem));
    if (!line) throw new ApiError(422, "Each requisition item needs an approval quantity");
    const approvedQty = Number(line.approvedQty);
    if (!Number.isFinite(approvedQty) || approvedQty < 0 || approvedQty > Number(item.requestedQty)) throw new ApiError(422, "Approved quantity must be between zero and requested quantity");
    item.approvedQty = approvedQty;
  }
  if (!requisition.items.some((item) => Number(item.approvedQty) > 0)) throw new ApiError(422, "At least one item must be approved");
  requisition.approvedBy = user._id;
  requisition.approvedAt = new Date();
  requisition.status = updateRequisitionStatus(requisition);
  requisition.history.push({ action: "REQUISITION_APPROVED", by: user._id });
  await requisition.save();
  return requisition;
};

export const rejectRequisition = async ({ user, requisitionId, reason }) => {
  const restaurant = requireRestaurant(user);
  if (!canManageCentralKitchen(user)) throw new ApiError(403, "You are not allowed to reject requisitions");
  const requisition = await CentralKitchenRequisition.findOne({ _id: requisitionId, restaurant });
  if (!requisition) throw new ApiError(404, "Requisition not found");
  if (!["DRAFT", "SUBMITTED", "PARTIALLY_APPROVED"].includes(requisition.status)) throw new ApiError(409, "This requisition can no longer be rejected");
  if (!String(reason || "").trim()) throw new ApiError(422, "A rejection reason is required");
  requisition.status = "REJECTED";
  requisition.rejectedBy = user._id;
  requisition.rejectedAt = new Date();
  requisition.rejectionReason = String(reason).trim();
  requisition.history.push({ action: "REQUISITION_REJECTED", by: user._id, note: requisition.rejectionReason });
  await requisition.save();
  return requisition;
};

export const cancelRequisition = async ({ user, requisitionId }) => {
  const restaurant = requireRestaurant(user);
  const requisition = await CentralKitchenRequisition.findOne({ _id: requisitionId, restaurant });
  if (!requisition) throw new ApiError(404, "Requisition not found");
  if (!canManageCentralKitchen(user) && (!same(user.activeOutlet, requisition.outlet) || !same(user._id, requisition.requestedBy))) throw new ApiError(403, "You are not allowed to cancel this requisition");
  if (!["DRAFT", "SUBMITTED", "APPROVED", "PARTIALLY_APPROVED"].includes(requisition.status) || requisition.items.some((item) => Number(item.dispatchedQty || 0) > 0)) throw new ApiError(409, "A requisition with dispatched stock cannot be cancelled");
  requisition.status = "CANCELLED";
  requisition.cancelledBy = user._id;
  requisition.cancelledAt = new Date();
  requisition.history.push({ action: "REQUISITION_CANCELLED", by: user._id });
  await requisition.save();
  return requisition;
};

export const startBatch = async ({ user, batchId }) => {
  const restaurant = requireRestaurant(user);
  if (!canManageCentralKitchen(user)) throw new ApiError(403, "You are not allowed to manage production");
  const batch = await ProductionBatch.findOne({ _id: batchId, restaurant });
  if (!batch) throw new ApiError(404, "Production batch not found");
  if (batch.status !== "PLANNED") throw new ApiError(409, "Only planned batches can be started");
  batch.status = "IN_PROGRESS";
  batch.startedBy = user._id;
  batch.startedAt = new Date();
  batch.history.push({ action: "BATCH_STARTED", by: user._id });
  await batch.save();
  return batch;
};

export const createBatch = async ({ user, centralKitchen, recipeId, outputInventoryItem, plannedQty, unit, notes = "", expiryDate = null }) => {
  const restaurant = requireRestaurant(user);
  if (!canManageCentralKitchen(user)) throw new ApiError(403, "You are not allowed to manage production");
  await getCentralKitchen({ restaurant, centralKitchen });
  const recipe = await Recipe.findOne({ _id: recipeId, restaurant, centralKitchen, status: "ACTIVE" });
  if (!recipe) throw new ApiError(422, "An active recipe is required");
  const [output] = await normalizeCentralLines({ restaurant, centralKitchen, lines: [{ centralInventoryItem: outputInventoryItem, quantity: plannedQty, unit }], quantityKey: "quantity" });
  return ProductionBatch.create({ batchNumber: reference("BAT"), restaurant, centralKitchen, recipe: recipe._id, recipeVersion: recipe.version, outputInventoryItem: output.centralInventoryItem, plannedQty: output.quantity, unit: output.unit, notes: String(notes || "").trim(), expiryDate: expiryDate || null, history: [{ action: "BATCH_PLANNED", by: user._id }] });
};

export const completeBatch = async ({ user, batchId, actualQty, unit, productionLossQty = 0, lossReason = "" }) => {
  const restaurant = requireRestaurant(user);
  if (!canManageCentralKitchen(user)) throw new ApiError(403, "You are not allowed to complete production");
  const session = await mongoose.startSession();
  let completed;
  try {
    await session.withTransaction(async () => {
      const batch = await ProductionBatch.findOne({ _id: batchId, restaurant }).session(session);
      if (!batch) throw new ApiError(404, "Production batch not found");
      if (batch.status !== "IN_PROGRESS") throw new ApiError(409, "Only in-progress batches can be completed");
      const recipe = await Recipe.findOne({ _id: batch.recipe, restaurant, centralKitchen: batch.centralKitchen, status: "ACTIVE" }).session(session);
      if (!recipe || Number(recipe.version) !== Number(batch.recipeVersion)) throw new ApiError(409, "The batch recipe is no longer available at its planned version");
      const [output] = await normalizeCentralLines({ restaurant, centralKitchen: batch.centralKitchen, lines: [{ centralInventoryItem: batch.outputInventoryItem, quantity: actualQty, unit: unit || batch.unit }], quantityKey: "quantity", session });
      const recipeOutput = convertQuantity(output.quantity, output.unit, recipe.yieldUnit);
      if (recipeOutput === null) throw new ApiError(422, "Batch output unit is incompatible with recipe yield");
      const multiplier = recipeOutput / Math.max(Number(recipe.yieldQuantity || 0), 0.000001);
      const ingredientLines = await normalizeCentralLines({ restaurant, centralKitchen: batch.centralKitchen, lines: recipe.ingredients.map((line) => ({ centralInventoryItem: line.inventoryItem, quantity: Number(line.quantity) * multiplier, unit: line.unit })), quantityKey: "quantity", session });
      for (const line of ingredientLines) await recordStockMovement({ restaurant, centralKitchen: batch.centralKitchen, inventoryItem: line.centralInventoryItem, movementType: "PRODUCTION_CONSUMPTION", quantity: line.quantity, unit: line.unit, referenceType: "PRODUCTION_BATCH", referenceId: batch._id, idempotencyKey: `batch:${batch._id}:ingredient:${line.centralInventoryItem}`, reason: `Production ${batch.batchNumber}`, user: user._id, metadata: { batchId: String(batch._id), recipeId: String(recipe._id), recipeVersion: recipe.version }, session });
      await recordStockMovement({ restaurant, centralKitchen: batch.centralKitchen, inventoryItem: output.centralInventoryItem, movementType: "PRODUCTION_OUTPUT", quantity: output.quantity, unit: output.unit, referenceType: "PRODUCTION_BATCH", referenceId: batch._id, idempotencyKey: `batch:${batch._id}:output`, reason: `Production output ${batch.batchNumber}`, user: user._id, metadata: { batchId: String(batch._id), expiryDate: batch.expiryDate }, session });
      batch.actualQty = output.quantity;
      batch.productionLossQty = Math.max(0, Number(productionLossQty || 0));
      batch.lossReason = String(lossReason || "").trim();
      batch.status = "COMPLETED";
      batch.completedAt = new Date();
      batch.completedBy = user._id;
      batch.history.push({ action: "BATCH_COMPLETED", by: user._id, note: batch.lossReason || "" });
      await batch.save({ session });
      completed = batch;
    });
  } finally { await session.endSession(); }
  return completed;
};

export const createTransfer = async ({ user, centralKitchen, destinationOutlet, requisitionId = null, items, notes = "" }) => {
  const restaurant = requireRestaurant(user);
  if (!canManageCentralKitchen(user)) throw new ApiError(403, "You are not allowed to create transfers");
  await getCentralKitchen({ restaurant, centralKitchen });
  if (!mongoose.isValidObjectId(destinationOutlet)) throw new ApiError(422, "Destination outlet is invalid");
  const outlet = await Outlet.findOne({ _id: destinationOutlet, restaurant, isActive: true }).select("_id").lean();
  if (!outlet) throw new ApiError(404, "Destination outlet not found");
  const lines = await normalizeCentralLines({ restaurant, centralKitchen, lines: items, quantityKey: "dispatchedQty" });
  let requisition = null;
  if (requisitionId) {
    requisition = await CentralKitchenRequisition.findOne({ _id: requisitionId, restaurant, centralKitchen, outlet: destinationOutlet });
    if (!requisition) throw new ApiError(404, "Requisition not found for this destination");
    if (!["APPROVED", "PARTIALLY_APPROVED", "PARTIALLY_DISPATCHED"].includes(requisition.status)) throw new ApiError(409, "This requisition cannot be transferred");
    for (const line of lines) {
      const requestLine = requisition.items.find((item) => same(item.centralInventoryItem, line.centralInventoryItem));
      if (!requestLine) throw new ApiError(422, "Transfer contains an item not requested by the outlet");
      if (Number(line.quantity) > Number(requestLine.approvedQty || 0) - Number(requestLine.dispatchedQty || 0)) throw new ApiError(409, "Transfer exceeds the remaining approved quantity");
    }
  }
  return CentralKitchenTransfer.create({ transferNumber: reference("TRF"), restaurant, centralKitchen, destinationOutlet, requisition: requisition?._id || null, createdBy: user._id, notes: String(notes || "").trim(), items: lines.map((line) => ({ centralInventoryItem: line.centralInventoryItem, requisitionItem: requisition?.items.find((item) => same(item.centralInventoryItem, line.centralInventoryItem))?._id || null, dispatchedQty: line.quantity, unit: line.unit })), history: [{ action: "TRANSFER_CREATED", by: user._id }] });
};

export const dispatchTransfer = async ({ user, transferId, idempotencyKey }) => {
  const restaurant = requireRestaurant(user);
  if (!canManageCentralKitchen(user)) throw new ApiError(403, "You are not allowed to dispatch transfers");
  if (!String(idempotencyKey || "").trim()) throw new ApiError(422, "An idempotency key is required to dispatch a transfer");
  const session = await mongoose.startSession();
  let dispatched;
  try {
    await session.withTransaction(async () => {
      const transfer = await CentralKitchenTransfer.findOne({ _id: transferId, restaurant }).session(session);
      if (!transfer) throw new ApiError(404, "Transfer not found");
      if (transfer.status === "DISPATCHED" && transfer.dispatchIdempotencyKey === idempotencyKey) { dispatched = transfer; return; }
      if (transfer.status !== "READY") throw new ApiError(409, "Only ready transfers can be dispatched");
      let requisition = null;
      if (transfer.requisition) requisition = await CentralKitchenRequisition.findOne({ _id: transfer.requisition, restaurant }).session(session);
      for (const item of transfer.items) {
        if (requisition) {
          const requestLine = requisition.items.id(item.requisitionItem) || requisition.items.find((line) => same(line.centralInventoryItem, item.centralInventoryItem));
          if (!requestLine || Number(item.dispatchedQty) > Number(requestLine.approvedQty) - Number(requestLine.dispatchedQty)) throw new ApiError(409, "Transfer exceeds remaining approved quantity");
        }
        await recordStockMovement({ restaurant, centralKitchen: transfer.centralKitchen, inventoryItem: item.centralInventoryItem, movementType: "TRANSFER_OUT", quantity: item.dispatchedQty, unit: item.unit, referenceType: "CENTRAL_KITCHEN_TRANSFER", referenceId: transfer._id, idempotencyKey: `transfer:${transfer._id}:dispatch:${item._id}`, reason: `Dispatched ${transfer.transferNumber}`, user: user._id, metadata: { transferId: String(transfer._id), destinationOutlet: String(transfer.destinationOutlet) }, session });
        if (requisition) {
          const requestLine = requisition.items.id(item.requisitionItem) || requisition.items.find((line) => same(line.centralInventoryItem, item.centralInventoryItem));
          requestLine.dispatchedQty = Number(requestLine.dispatchedQty || 0) + Number(item.dispatchedQty);
        }
      }
      if (requisition) { requisition.status = updateRequisitionStatus(requisition); await requisition.save({ session }); }
      transfer.status = "DISPATCHED";
      transfer.dispatchedBy = user._id;
      transfer.dispatchedAt = new Date();
      transfer.dispatchIdempotencyKey = String(idempotencyKey).trim();
      transfer.history.push({ action: "TRANSFER_DISPATCHED", by: user._id });
      await transfer.save({ session });
      dispatched = transfer;
    });
  } finally { await session.endSession(); }
  return dispatched;
};

export const cancelTransfer = async ({ user, transferId }) => {
  const restaurant = requireRestaurant(user);
  if (!canManageCentralKitchen(user)) throw new ApiError(403, "You are not allowed to cancel transfers");
  const transfer = await CentralKitchenTransfer.findOne({ _id: transferId, restaurant });
  if (!transfer) throw new ApiError(404, "Transfer not found");
  if (transfer.status !== "READY") throw new ApiError(409, "Only undisbursed transfers can be cancelled");
  transfer.status = "CANCELLED";
  transfer.history.push({ action: "TRANSFER_CANCELLED", by: user._id });
  await transfer.save();
  return transfer;
};

export const receiveTransfer = async ({ user, transferId, items, idempotencyKey, notes = "" }) => {
  const restaurant = requireRestaurant(user);
  if (!String(idempotencyKey || "").trim()) throw new ApiError(422, "An idempotency key is required to receive a transfer");
  const session = await mongoose.startSession();
  let received;
  try {
    await session.withTransaction(async () => {
      const transfer = await CentralKitchenTransfer.findOne({ _id: transferId, restaurant }).session(session);
      if (!transfer) throw new ApiError(404, "Transfer not found");
      const isDestination = same(user.activeOutlet, transfer.destinationOutlet);
      if (!canManageCentralKitchen(user) && !isDestination) throw new ApiError(403, "You are not authorized to receive this transfer");
      if (transfer.receiveIdempotencyKeys.includes(String(idempotencyKey).trim())) { received = transfer; return; }
      if (!["DISPATCHED", "PARTIALLY_RECEIVED"].includes(transfer.status)) throw new ApiError(409, "This transfer cannot be received");
      const byLine = new Map((items || []).map((item) => [String(item.transferItemId || item._id), item]));
      if (!byLine.size) throw new ApiError(422, "Received quantities are required");
      const requisition = transfer.requisition ? await CentralKitchenRequisition.findOne({ _id: transfer.requisition, restaurant }).session(session) : null;
      for (const line of transfer.items) {
        const receipt = byLine.get(String(line._id));
        if (!receipt) continue;
        const quantity = number(receipt.receivedQty, "Received quantity");
        const remaining = Number(line.dispatchedQty) - Number(line.receivedQty || 0);
        if (quantity > remaining) throw new ApiError(422, "Received quantity cannot exceed dispatched quantity");
        const source = await Inventory.findOne({ _id: line.centralInventoryItem, restaurant, centralKitchen: transfer.centralKitchen, outlet: null }).session(session);
        if (!source) throw new ApiError(409, "Source inventory item no longer exists");
        let destination = await Inventory.findOne({ restaurant, outlet: transfer.destinationOutlet, centralKitchen: null, sku: source.sku }).session(session);
        if (!destination) {
          [destination] = await Inventory.create([{ restaurant, outlet: transfer.destinationOutlet, centralKitchen: null, itemName: source.itemName, sku: source.sku, quantity: 0, unit: source.unit, baseUnit: source.baseUnit, minStock: source.minStock, reorderLevel: source.reorderLevel, maxStock: source.maxStock, costPerUnit: source.costPerUnit, supplier: source.supplier, category: source.category, storageLocation: source.storageLocation, isActive: true }], { session });
        }
        await recordStockMovement({ restaurant, outlet: transfer.destinationOutlet, inventoryItem: destination._id, movementType: "TRANSFER_IN", quantity, unit: line.unit, referenceType: "CENTRAL_KITCHEN_TRANSFER", referenceId: transfer._id, idempotencyKey: `transfer:${transfer._id}:receive:${line._id}:${idempotencyKey}`, reason: `Received ${transfer.transferNumber}`, user: user._id, metadata: { transferId: String(transfer._id), centralKitchen: String(transfer.centralKitchen) }, session });
        line.destinationInventoryItem = destination._id;
        line.receivedQty = Number(line.receivedQty || 0) + quantity;
        if (receipt.discrepancyReason) line.discrepancyReason = String(receipt.discrepancyReason).trim();
        if (requisition) {
          const requestLine = requisition.items.id(line.requisitionItem) || requisition.items.find((item) => same(item.centralInventoryItem, line.centralInventoryItem));
          if (requestLine) requestLine.fulfilledQty = Number(requestLine.fulfilledQty || 0) + quantity;
        }
      }
      const allReceived = transfer.items.every((line) => Number(line.receivedQty || 0) >= Number(line.dispatchedQty));
      transfer.status = allReceived ? "RECEIVED" : "PARTIALLY_RECEIVED";
      transfer.receivedBy = user._id;
      transfer.receivedAt = new Date();
      transfer.notes = [transfer.notes, String(notes || "").trim()].filter(Boolean).join("\n").slice(0, 1000);
      transfer.receiveIdempotencyKeys.push(String(idempotencyKey).trim());
      transfer.history.push({ action: allReceived ? "TRANSFER_RECEIVED" : "TRANSFER_PARTIALLY_RECEIVED", by: user._id, note: String(notes || "").trim() });
      await transfer.save({ session });
      if (requisition) { requisition.status = updateRequisitionStatus(requisition); await requisition.save({ session }); }
      received = transfer;
    });
  } finally { await session.endSession(); }
  return received;
};

export const scopeCentralKitchenList = ({ user, query = {} }) => {
  const restaurant = requireRestaurant(user);
  const filter = { restaurant };
  if (query.centralKitchen && mongoose.isValidObjectId(query.centralKitchen)) filter.centralKitchen = query.centralKitchen;
  if (query.status) filter.status = query.status;
  if (!canManageCentralKitchen(user)) filter.outlet = requireOutlet(user);
  else if (query.outlet && mongoose.isValidObjectId(query.outlet)) filter.outlet = query.outlet;
  return filter;
};
