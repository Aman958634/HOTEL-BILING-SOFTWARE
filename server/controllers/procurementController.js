import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import Supplier from "../models/Supplier.js";
import PurchaseOrder from "../models/PurchaseOrder.js";
import GoodsReceipt from "../models/GoodsReceipt.js";
import { buildOutletQuery } from "../utils/tenantUtils.js";
import { getPagination } from "../utils/pagination.js";
import { resolveRestaurantId } from "../services/inventoryService.js";
import { createSupplier, updateSupplier, toggleSupplier, createPurchaseOrder, updateDraftPurchaseOrder, transitionPurchaseOrder, receivePurchaseOrder } from "../services/procurementService.js";

const outlet = (req) => { if (!req.user.activeOutlet) throw new ApiError(403, "Active outlet required"); return req.user.activeOutlet; };
const restaurant = (req) => resolveRestaurantId(req.user);

export const listSuppliers = asyncHandler(async (req, res) => {
	const { page, limit, skip } = getPagination(req.query);
	const filter = { restaurant: restaurant(req) };
	if (req.query.search) filter.name = { $regex: String(req.query.search).trim(), $options: "i" };
	if (req.query.isActive !== undefined) filter.isActive = req.query.isActive === "true";
	const [items, total] = await Promise.all([Supplier.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(), Supplier.countDocuments(filter)]);
	res.json(new ApiResponse(true, "Suppliers fetched", items, { page, limit, total, totalPages: Math.ceil(total / limit) }));
});
export const getSupplier = asyncHandler(async (req, res) => { const supplier = await Supplier.findOne({ _id: req.params.id, restaurant: restaurant(req) }).lean(); if (!supplier) throw new ApiError(404, "Supplier not found"); res.json(new ApiResponse(true, "Supplier fetched", supplier)); });
export const createSupplierController = asyncHandler(async (req, res) => res.status(201).json(new ApiResponse(true, "Supplier created", await createSupplier({ restaurant: restaurant(req), user: req.user, data: req.body }))));
export const updateSupplierController = asyncHandler(async (req, res) => res.json(new ApiResponse(true, "Supplier updated", await updateSupplier({ restaurant: restaurant(req), user: req.user, supplierId: req.params.id, data: req.body }))));
export const toggleSupplierController = asyncHandler(async (req, res) => res.json(new ApiResponse(true, "Supplier status updated", await toggleSupplier({ restaurant: restaurant(req), user: req.user, supplierId: req.params.id }))));

export const listPurchaseOrders = asyncHandler(async (req, res) => {
	const { page, limit, skip } = getPagination(req.query);
	const filter = await buildOutletQuery({}, req.user);
	if (req.query.status) filter.status = String(req.query.status).toUpperCase();
	if (req.query.supplier) filter.supplier = req.query.supplier;
	if (req.query.search) filter.poNumber = { $regex: String(req.query.search).trim(), $options: "i" };
	const [items, total] = await Promise.all([
		PurchaseOrder.find(filter).populate("supplier", "name phone").populate("outlet", "name code").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
		PurchaseOrder.countDocuments(filter),
	]);
	res.json(new ApiResponse(true, "Purchase orders fetched", items, { page, limit, total, totalPages: Math.ceil(total / limit) }));
});
export const getPurchaseOrder = asyncHandler(async (req, res) => { const po = await PurchaseOrder.findOne(await buildOutletQuery({ _id: req.params.id }, req.user)).populate("supplier", "name phone").populate("lines.inventoryItem", "itemName sku unit baseUnit").lean(); if (!po) throw new ApiError(404, "Purchase order not found"); res.json(new ApiResponse(true, "Purchase order fetched", po)); });
export const createPurchaseOrderController = asyncHandler(async (req, res) => res.status(201).json(new ApiResponse(true, "Purchase order created", await createPurchaseOrder({ restaurant: restaurant(req), outlet: outlet(req), user: req.user, data: req.body, idempotencyKey: String(req.get("Idempotency-Key") || "").trim() }))));
export const updatePurchaseOrderController = asyncHandler(async (req, res) => res.json(new ApiResponse(true, "Purchase order updated", await updateDraftPurchaseOrder({ restaurant: restaurant(req), outlet: outlet(req), user: req.user, poId: req.params.id, data: req.body }))));
export const placePurchaseOrder = asyncHandler(async (req, res) => res.json(new ApiResponse(true, "Purchase order placed", await transitionPurchaseOrder({ restaurant: restaurant(req), outlet: outlet(req), user: req.user, poId: req.params.id, action: "place" }))));
export const cancelPurchaseOrder = asyncHandler(async (req, res) => res.json(new ApiResponse(true, "Purchase order cancelled", await transitionPurchaseOrder({ restaurant: restaurant(req), outlet: outlet(req), user: req.user, poId: req.params.id, action: "cancel" }))));
export const receivePurchaseOrderController = asyncHandler(async (req, res) => res.status(201).json(new ApiResponse(true, "Goods receipt created", await receivePurchaseOrder({ restaurant: restaurant(req), outlet: outlet(req), user: req.user, poId: req.params.id, data: req.body, idempotencyKey: String(req.get("Idempotency-Key") || "").trim() }))));
export const listGoodsReceipts = asyncHandler(async (req, res) => {
	const { page, limit, skip } = getPagination(req.query);
	const filter = await buildOutletQuery({}, req.user);
	if (req.query.purchaseOrder) filter.purchaseOrder = req.query.purchaseOrder;
	const [items, total] = await Promise.all([
		GoodsReceipt.find(filter).populate("supplier", "name").populate("purchaseOrder", "poNumber").sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
		GoodsReceipt.countDocuments(filter),
	]);
	res.json(new ApiResponse(true, "Goods receipts fetched", items, { page, limit, total, totalPages: Math.ceil(total / limit) }));
});