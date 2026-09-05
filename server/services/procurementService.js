import mongoose from "mongoose";
import ApiError from "../utils/ApiError.js";
import Inventory from "../models/Inventory.js";
import Supplier from "../models/Supplier.js";
import PurchaseOrder from "../models/PurchaseOrder.js";
import GoodsReceipt from "../models/GoodsReceipt.js";
import { convertQuantity } from "../utils/inventoryUnits.js";
import { recordStockMovement } from "./inventoryService.js";
import { createActivity } from "./activityService.js";

const money = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
const id = (value, field) => {
  if (!mongoose.isValidObjectId(value)) throw new ApiError(422, `${field} is invalid`);
  return value;
};
const positive = (value, field) => {
  const result = Number(value);
  if (!Number.isFinite(result) || result <= 0) throw new ApiError(422, `${field} must be greater than zero`);
  return result;
};
const reference = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

export const normalizePurchaseLines = (lines = [], inventoryItems = []) => {
  if (!Array.isArray(lines) || !lines.length) throw new ApiError(422, "At least one inventory line is required");
  const byId = new Map(inventoryItems.map((item) => [String(item._id), item]));
  const seen = new Set();
  return lines.map((line) => {
    const inventoryItem = byId.get(String(id(line.inventoryItem, "inventoryItem")));
    if (!inventoryItem) throw new ApiError(422, "Inventory lines must belong to the active outlet");
    if (seen.has(String(inventoryItem._id))) throw new ApiError(422, "Purchase order contains duplicate inventory items");
    seen.add(String(inventoryItem._id));
    const quantity = positive(line.quantity, "Quantity");
    const unit = String(line.unit || inventoryItem.unit || inventoryItem.baseUnit || "").trim().toLowerCase();
    const baseUnit = String(inventoryItem.baseUnit || inventoryItem.unit || "").trim().toLowerCase();
    const baseQuantity = convertQuantity(quantity, unit, baseUnit);
    if (baseQuantity === null) throw new ApiError(422, `Cannot convert ${unit} to ${baseUnit} for ${inventoryItem.itemName}`);
    const costPerUnit = Number(line.costPerUnit);
    if (!Number.isFinite(costPerUnit) || costPerUnit < 0) throw new ApiError(422, "Cost per unit must be zero or greater");
    return { inventoryItem: inventoryItem._id, itemName: inventoryItem.itemName, sku: inventoryItem.sku, quantity, unit, baseQuantity, baseUnit, costPerUnit: money(costPerUnit), lineTotal: money(quantity * costPerUnit), receivedQuantity: 0 };
  });
};

export const calculatePurchaseTotals = (lines) => ({ subtotal: money(lines.reduce((total, line) => total + Number(line.lineTotal || 0), 0)) });

export const supplierFilter = (restaurant, supplierId = null) => ({ restaurant, ...(supplierId ? { _id: id(supplierId, "supplier") } : {}) });

export const createSupplier = async ({ restaurant, user, data }) => {
  const name = String(data.name || "").trim();
  const phone = String(data.phone || "").trim();
  if (!name || !phone) throw new ApiError(422, "Supplier name and phone are required");
  const supplier = await Supplier.create({ restaurant, name, phone, email: String(data.email || "").trim(), address: String(data.address || "").trim(), isActive: data.isActive !== false });
  await createActivity({ action: "Supplier Created", description: `Supplier ${supplier.name} created`, performedBy: user._id, restaurantId: restaurant, targetId: supplier._id, targetType: "Supplier" });
  return supplier;
};

export const updateSupplier = async ({ restaurant, user, supplierId, data }) => {
  const allowed = ["name", "phone", "email", "address"];
  const update = Object.fromEntries(allowed.filter((key) => data[key] !== undefined).map((key) => [key, String(data[key]).trim()]));
  if (update.name === "" || update.phone === "") throw new ApiError(422, "Supplier name and phone are required");
  const supplier = await Supplier.findOneAndUpdate({ _id: id(supplierId, "supplier"), restaurant }, { $set: update }, { new: true, runValidators: true });
  if (!supplier) throw new ApiError(404, "Supplier not found");
  await createActivity({ action: "Supplier Updated", description: `Supplier ${supplier.name} updated`, performedBy: user._id, restaurantId: restaurant, targetId: supplier._id, targetType: "Supplier" });
  return supplier;
};

export const toggleSupplier = async ({ restaurant, user, supplierId }) => {
  const supplier = await Supplier.findOne({ _id: id(supplierId, "supplier"), restaurant });
  if (!supplier) throw new ApiError(404, "Supplier not found");
  supplier.isActive = !supplier.isActive;
  await supplier.save();
  await createActivity({ action: "Supplier Status Changed", description: `${supplier.name} ${supplier.isActive ? "activated" : "deactivated"}`, performedBy: user._id, restaurantId: restaurant, targetId: supplier._id, targetType: "Supplier" });
  return supplier;
};

const outletInventory = async (restaurant, outlet, lines, session = null) => {
  const ids = lines.map((line) => id(line.inventoryItem, "inventoryItem"));
  const items = await Inventory.find({ _id: { $in: ids }, restaurant, outlet, centralKitchen: null, isActive: { $ne: false } }).session(session).lean();
  if (items.length !== new Set(ids.map(String)).size) throw new ApiError(422, "Inventory lines must belong to the active outlet and restaurant");
  return items;
};

export const createPurchaseOrder = async ({ restaurant, outlet, user, data, idempotencyKey = "" }) => {
  if (idempotencyKey) {
    const existing = await PurchaseOrder.findOne({ restaurant, idempotencyKey });
    if (existing) return existing;
  }
  const supplier = await Supplier.findOne({ _id: id(data.supplier, "supplier"), restaurant, isActive: true });
  if (!supplier) throw new ApiError(404, "Active supplier not found");
  const items = await outletInventory(restaurant, outlet, data.lines);
  const lines = normalizePurchaseLines(data.lines, items);
  const po = await PurchaseOrder.create({ poNumber: reference("PO"), idempotencyKey: idempotencyKey || null, restaurant, outlet, supplier: supplier._id, lines, ...calculatePurchaseTotals(lines), notes: String(data.notes || "").trim(), createdBy: user._id, history: [{ action: "DRAFT_CREATED", by: user._id }] });
  await createActivity({ action: "Purchase Order Created", description: `${po.poNumber} created`, performedBy: user._id, restaurantId: restaurant, targetId: po._id, targetType: "PurchaseOrder", metadata: { supplierId: String(supplier._id), outletId: String(outlet) } });
  return po;
};

export const updateDraftPurchaseOrder = async ({ restaurant, outlet, user, poId, data }) => {
  const po = await PurchaseOrder.findOne({ _id: id(poId, "purchase order"), restaurant, outlet, status: "DRAFT" });
  if (!po) throw new ApiError(404, "Draft purchase order not found");
  if (data.supplier) {
    const supplier = await Supplier.findOne({ _id: id(data.supplier, "supplier"), restaurant, isActive: true });
    if (!supplier) throw new ApiError(404, "Active supplier not found");
    po.supplier = supplier._id;
  }
  if (data.lines) {
    const items = await outletInventory(restaurant, outlet, data.lines);
    po.lines = normalizePurchaseLines(data.lines, items);
    po.subtotal = calculatePurchaseTotals(po.lines).subtotal;
  }
  if (data.notes !== undefined) po.notes = String(data.notes).trim();
  po.history.push({ action: "DRAFT_UPDATED", by: user._id });
  await po.save();
  return po;
};

export const transitionPurchaseOrder = async ({ restaurant, outlet, user, poId, action }) => {
  const po = await PurchaseOrder.findOne({ _id: id(poId, "purchase order"), restaurant, outlet });
  if (!po) throw new ApiError(404, "Purchase order not found");
  const transitions = { place: { allowed: ["DRAFT"], target: "PLACED" }, cancel: { allowed: ["DRAFT", "PLACED", "PARTIALLY_RECEIVED"], target: "CANCELLED" } };
  const transition = transitions[action];
  if (!transition || !transition.allowed.includes(po.status)) throw new ApiError(409, `Cannot ${action} a ${po.status.toLowerCase()} purchase order`);
  po.status = transition.target;
  po.history.push({ action: action === "place" ? "PLACED" : "CANCELLED", by: user._id });
  await po.save();
  await createActivity({ action: `Purchase Order ${po.status}`, description: `${po.poNumber} ${po.status.toLowerCase()}`, performedBy: user._id, restaurantId: restaurant, targetId: po._id, targetType: "PurchaseOrder" });
  return po;
};

export const receivePurchaseOrder = async ({ restaurant, outlet, user, poId, data, idempotencyKey }) => {
  if (!idempotencyKey) throw new ApiError(422, "Idempotency-Key is required");
  const existing = await GoodsReceipt.findOne({ restaurant, idempotencyKey });
  if (existing) {
    if (String(existing.purchaseOrder) !== String(poId) || String(existing.outlet) !== String(outlet)) throw new ApiError(409, "Idempotency-Key was already used for another purchase order");
    return existing;
  }
  const session = await mongoose.startSession();
  try {
    let receipt;
    await session.withTransaction(async () => {
      const po = await PurchaseOrder.findOne({ _id: id(poId, "purchase order"), restaurant, outlet }).session(session);
      if (!po) throw new ApiError(404, "Purchase order not found");
      if (!["PLACED", "PARTIALLY_RECEIVED"].includes(po.status)) throw new ApiError(409, "Only placed purchase orders can be received");
      const requested = Array.isArray(data.lines) ? data.lines : [];
      if (!requested.length) throw new ApiError(422, "At least one receipt line is required");
      const receiptLines = [];
      const seen = new Set();
      for (const input of requested) {
        const line = po.lines.id(input.poLine);
        if (!line || seen.has(String(line._id))) throw new ApiError(422, "Receipt line is invalid or duplicated");
        seen.add(String(line._id));
        const quantity = positive(input.quantity, "Received quantity");
        const unit = String(input.unit || line.unit).trim().toLowerCase();
        const baseQuantity = convertQuantity(quantity, unit, line.baseUnit);
        if (baseQuantity === null) throw new ApiError(422, `Cannot convert ${unit} to ${line.baseUnit}`);
        if (line.receivedQuantity + baseQuantity > line.baseQuantity + 1e-9) throw new ApiError(409, `Cannot receive more than ordered for ${line.itemName}`);
        line.receivedQuantity = money(line.receivedQuantity + baseQuantity);
        receiptLines.push({ poLine: line._id, inventoryItem: line.inventoryItem, receivedQuantity: quantity, unit, baseQuantity, baseUnit: line.baseUnit });
      }
      const allReceived = po.lines.every((line) => line.receivedQuantity >= line.baseQuantity - 1e-9);
      po.status = allReceived ? "RECEIVED" : "PARTIALLY_RECEIVED";
      po.history.push({ action: "RECEIVED", by: user._id });
      receipt = (await GoodsReceipt.create([{ grnNumber: reference("GRN"), idempotencyKey, restaurant, outlet, purchaseOrder: po._id, supplier: po.supplier, lines: receiptLines, receivedBy: user._id, notes: String(data.notes || "").trim() }], { session }))[0];
      for (const line of receiptLines) await recordStockMovement({ restaurant, outlet, inventoryItem: line.inventoryItem, movementType: "PURCHASE", quantity: line.baseQuantity, unit: line.baseUnit, referenceType: "GRN", referenceId: receipt._id, idempotencyKey: `grn:${receipt._id}:${line.poLine}`, reason: `Goods receipt ${receipt.grnNumber}`, user: user._id, metadata: { purchaseOrderId: String(po._id), poNumber: po.poNumber, grnNumber: receipt.grnNumber, supplierId: String(po.supplier) }, session });
      await po.save({ session });
    });
    await createActivity({ action: "Goods Receipt Created", description: `${receipt.grnNumber} received`, performedBy: user._id, restaurantId: restaurant, targetId: receipt._id, targetType: "GoodsReceipt", metadata: { purchaseOrderId: String(poId) } });
    return receipt;
  } finally {
    await session.endSession();
  }
};