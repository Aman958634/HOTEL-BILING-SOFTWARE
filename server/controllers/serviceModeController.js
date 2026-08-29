import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { buildOutletQuery } from "../utils/tenantUtils.js";
import Table from "../models/Table.js";
import Order from "../models/Order.js";
import Bill from "../models/Bill.js";
import Staff from "../models/Staff.js";
import Food from "../models/Food.js";

const ACTIVE_ORDER_STATUSES = ["PENDING", "CONFIRMED", "PREPARING", "READY", "SERVED"];
const SERVICE_ROLES = ["admin", "manager", "cashier", "waiter"];
const isWaiter = (user) => String(user?.role || "").toLowerCase() === "waiter";
const asId = (value) => String(value?._id || value || "");

const serviceScope = async (user) => {
  const base = await buildOutletQuery({}, user);
  let staff = null;
  if (isWaiter(user)) {
    staff = await Staff.findOne(await buildOutletQuery({ user: user._id, status: "ACTIVE" }, user)).select("_id dutyStatus shiftStartedAt breakStartedAt").lean();
  }
  return { base, staff };
};

const summarizeTables = async ({ base, staff, user }) => {
  if (isWaiter(user) && !staff) return { tables: [], readyOrders: [], billsWaiting: 0, activeOrders: 0 };
  const tableFilter = { ...base, ...(isWaiter(user) ? { assignedStaff: staff?._id || null } : {}) };
  const tables = await Table.find(tableFilter).select("tableNumber status capacity floor section assignedStaff currentOrder").sort({ tableNumber: 1 }).limit(160).lean();
  const ids = tables.map((table) => table._id);
  if (!ids.length) return { tables: [], readyOrders: [], billsWaiting: 0, activeOrders: 0 };
  const [orders, bills] = await Promise.all([
    Order.find({ ...base, table: { $in: ids }, isArchived: { $ne: true }, status: { $in: ACTIVE_ORDER_STATUSES } }).select("_id orderNumber table status kitchenStatus paymentStatus total createdAt updatedAt items").sort({ createdAt: -1 }).limit(300).lean(),
    Bill.find({ ...base, table: { $in: ids }, status: { $in: ["OPEN", "PARTIALLY_PAID"] } }).select("table status total paidAmount balanceDue billNumber").lean(),
  ]);
  const orderMap = new Map();
  for (const order of orders) {
    const key = asId(order.table);
    const item = orderMap.get(key) || { count: 0, ready: 0, preparing: 0, total: 0, orders: [] };
    item.count += 1; item.total += Number(order.total || 0); item.orders.push(order);
    if (order.status === "READY" || order.kitchenStatus === "READY") item.ready += 1;
    if (order.status === "PREPARING" || order.kitchenStatus === "PREPARING") item.preparing += 1;
    orderMap.set(key, item);
  }
  const billMap = new Map(bills.map((bill) => [asId(bill.table), bill]));
  const compactTables = tables.map((table) => {
    const service = orderMap.get(asId(table._id)) || { count: 0, ready: 0, preparing: 0, total: 0, orders: [] };
    const bill = billMap.get(asId(table._id)) || null;
    return { ...table, service: { orderCount: service.count, readyCount: service.ready, preparingCount: service.preparing, total: service.total }, bill: bill ? { billNumber: bill.billNumber, status: bill.status, total: bill.total, paidAmount: bill.paidAmount, balanceDue: bill.balanceDue } : null };
  });
  const readyOrders = orders.filter((order) => order.status === "READY" || order.kitchenStatus === "READY").map((order) => ({ _id: order._id, orderNumber: order.orderNumber, table: tables.find((item) => asId(item._id) === asId(order.table))?.tableNumber || "—", createdAt: order.updatedAt || order.createdAt, items: (order.items || []).map((item) => ({ name: item.name || "Item", quantity: item.quantity || 1 })) }));
  return { tables: compactTables, readyOrders, billsWaiting: bills.length, activeOrders: orders.length };
};

export const getServiceSummary = asyncHandler(async (req, res) => {
  if (!SERVICE_ROLES.includes(String(req.user?.role || "").toLowerCase())) throw new ApiError(403, "Service mode is not available for this role");
  const { base, staff } = await serviceScope(req.user);
  const summary = await summarizeTables({ base, staff, user: req.user });
  res.json(new ApiResponse(true, "Service mode summary fetched", { ...summary, staff: staff ? { id: staff._id, dutyStatus: staff.dutyStatus, shiftStartedAt: staff.shiftStartedAt, breakStartedAt: staff.breakStartedAt } : null, scope: { outletId: req.user.activeOutlet || req.user.defaultOutlet || null, mode: isWaiter(req.user) ? "MY_TABLES" : "ALL_TABLES" }, generatedAt: new Date().toISOString() }));
});

export const getServiceTable = asyncHandler(async (req, res) => {
  if (!SERVICE_ROLES.includes(String(req.user?.role || "").toLowerCase())) throw new ApiError(403, "Service mode is not available for this role");
  const { base, staff } = await serviceScope(req.user);
  if (isWaiter(req.user) && !staff) throw new ApiError(403, "Your staff profile is not active for this outlet");
  const table = await Table.findOne({ ...base, _id: req.params.id, ...(isWaiter(req.user) ? { assignedStaff: staff?._id || null } : {}) }).select("tableNumber status capacity floor section assignedStaff").lean();
  if (!table) throw new ApiError(404, "Table not found");
  const [orders, bill] = await Promise.all([
    Order.find({ ...base, table: table._id, isArchived: { $ne: true }, status: { $in: ACTIVE_ORDER_STATUSES } }).select("_id orderNumber status kitchenStatus paymentStatus total createdAt updatedAt items specialInstructions").sort({ createdAt: -1 }).lean(),
    Bill.findOne({ ...base, table: table._id, status: { $in: ["OPEN", "PARTIALLY_PAID", "PAID"] } }).sort({ createdAt: -1 }).select("billNumber status total paidAmount balanceDue createdAt").lean(),
  ]);
  res.json(new ApiResponse(true, "Service table fetched", { ...table, orders, bill: bill || null }));
});

export const getServiceMenu = asyncHandler(async (req, res) => {
  if (!SERVICE_ROLES.includes(String(req.user?.role || "").toLowerCase())) throw new ApiError(403, "Service mode is not available for this role");
  const filter = await buildOutletQuery({ isAvailable: true, available: { $ne: false } }, req.user, { allowAll: true });
  // Food is tenant-level in the current model; outlet availability is still
  // revalidated by the order service at submission time.
  delete filter.outlet;
  const items = await Food.find(filter).select("name category description price discountPrice isAvailable available prepTimeMins foodType isVeg").populate("category", "name").sort({ name: 1 }).limit(500).lean();
  res.json(new ApiResponse(true, "Service menu fetched", items));
});
