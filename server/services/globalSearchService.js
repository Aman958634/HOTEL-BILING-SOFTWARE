import Bill from "../models/Bill.js";
import Food from "../models/Food.js";
import Inventory from "../models/Inventory.js";
import KotTicket from "../models/KotTicket.js";
import LoyaltyAccount from "../models/LoyaltyAccount.js";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Reservation from "../models/Reservation.js";
import Staff from "../models/Staff.js";
import Table from "../models/Table.js";
import User from "../models/User.js";
import CentralKitchenRequisition from "../models/CentralKitchenRequisition.js";
import ProductionBatch from "../models/ProductionBatch.js";
import CentralKitchenTransfer from "../models/CentralKitchenTransfer.js";
import ApiError from "../utils/ApiError.js";
import { buildRestaurantQuery } from "../utils/tenantUtils.js";
import { getAuthorizedRestaurantIds } from "./customerService.js";

export const GLOBAL_SEARCH_TYPES = Object.freeze([
  "orders", "onlineOrders", "customers", "bills", "payments", "tables",
  "staff", "menuItems", "kots", "reservations", "inventory", "loyalty", "centralKitchen",
]);

const RESULTS_PER_TYPE = 5;
const FETCH_LIMIT = RESULTS_PER_TYPE * 3;
const rolesFor = (...roles) => new Set(roles);
const SEARCH_ACCESS = Object.freeze({
  orders: rolesFor("admin", "manager", "cashier", "waiter", "chef", "delivery"),
  onlineOrders: rolesFor("admin", "manager", "cashier", "delivery"),
  customers: rolesFor("admin", "manager", "cashier", "waiter", "receptionist"),
  bills: rolesFor("admin", "manager", "cashier"),
  payments: rolesFor("admin", "manager", "cashier"),
  tables: rolesFor("admin", "manager", "cashier", "waiter", "receptionist"),
  staff: rolesFor("admin", "manager"),
  menuItems: rolesFor("admin", "manager", "cashier", "waiter", "chef", "inventory_manager"),
  kots: rolesFor("admin", "manager", "chef"),
  reservations: rolesFor("admin", "manager", "waiter", "receptionist"),
  inventory: rolesFor("admin", "manager", "inventory_manager"),
  loyalty: rolesFor("admin", "manager", "cashier"),
  centralKitchen: rolesFor("admin"),
});

const ONLINE_SOURCES = ["ONLINE", "DELIVERY", "PICKUP"];
const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const scoped = (scope, condition) => ({ $and: [scope, condition] });
const title = (value) => String(value || "").replaceAll("_", " ");

export const normalizeSearchQuery = (value) => {
  const raw = String(value || "");
  if (/[\u0000-\u001F\u007F]/.test(raw)) throw new ApiError(422, "Search query contains invalid characters");
  const query = raw.trim().replace(/\s+/g, " ");
  if (query.length > 100) throw new ApiError(422, "Search query must not exceed 100 characters");
  return query;
};

const normalizeTypes = (value) => {
  if (!value || String(value).toLowerCase() === "all") return null;
  const types = String(value).split(",").map((item) => item.trim()).filter(Boolean);
  if (!types.length || types.some((item) => !GLOBAL_SEARCH_TYPES.includes(item))) throw new ApiError(422, "Invalid search type");
  return new Set(types);
};

const normalizedRole = (user) => {
  const role = String(user?.role || "").toLowerCase();
  return role === "restaurant_admin" ? "admin" : role;
};
const canSearch = (user, type) => user?.role === "super_admin" || SEARCH_ACCESS[type]?.has(normalizedRole(user));
export const permittedSearchTypes = (user) => GLOBAL_SEARCH_TYPES.filter((type) => canSearch(user, type));
const prefixRegex = (query) => new RegExp(`^${escapeRegex(query)}`, "i");
const exact = (value, query) => String(value || "").toLowerCase() === String(query || "").toLowerCase();
const relevance = (values, query) => values.some((value) => exact(value, query)) ? 100 : 70;
const take = (rows, query, values) => rows.map((row) => ({ ...row, relevance: relevance(values(row), query) })).sort((a, b) => b.relevance - a.relevance).slice(0, RESULTS_PER_TYPE);
const route = (path, query) => `${path}?search=${encodeURIComponent(query)}`;

const findCustomerCandidates = async ({ restaurantIds, regex, normalizedPhone }) => User.find({
  role: "customer",
  isCrmArchived: { $ne: true },
  $and: [
    { $or: [{ restaurant: { $in: restaurantIds } }, { "customerRestaurants.restaurant": { $in: restaurantIds } }] },
    { $or: [{ fullName: regex }, { email: regex }, ...(normalizedPhone ? [{ phoneNormalized: { $regex: `^${escapeRegex(normalizedPhone)}` } }] : [])] },
  ],
}).select("_id fullName email phone phoneNormalized").limit(FETCH_LIMIT).lean();

const findTableCandidates = (scope, regex) => Table.find(scoped(scope, { tableNumber: regex })).select("_id tableNumber").limit(FETCH_LIMIT).lean();

const searchOrders = async ({ scope, regex, query, customerIds, tableIds, onlineOnly = false, deliveryOnly = false }) => {
  const local = {
    isArchived: { $ne: true },
    ...(onlineOnly ? { orderSource: { $in: ONLINE_SOURCES } } : { orderSource: { $nin: ONLINE_SOURCES } }),
    ...(deliveryOnly ? { orderType: "DELIVERY" } : {}),
    $or: [{ orderNumber: regex }, ...(customerIds.length ? [{ customer: { $in: customerIds } }] : []), ...(tableIds.length ? [{ table: { $in: tableIds } }] : [])],
  };
  const rows = await Order.find(scoped(scope, local)).select("orderNumber orderType orderSource status paymentStatus total customer table createdAt").populate("customer", "fullName").populate("table", "tableNumber").sort({ createdAt: -1 }).limit(FETCH_LIMIT).lean();
  return take(rows.map((row) => ({ type: onlineOnly ? "onlineOrders" : "orders", id: row._id, title: `Order #${row.orderNumber}`, subtitle: `${row.table?.tableNumber ? `Table ${row.table.tableNumber} · ` : ""}${title(row.orderSource || row.orderType)} · ${title(row.status)}`, metadata: { status: row.status, orderSource: row.orderSource || row.orderType }, route: route(onlineOnly ? "/dashboard/admin/online-orders" : "/dashboard/admin/orders", row.orderNumber), _rankValues: [row.orderNumber, row.customer?.fullName, row.table?.tableNumber] })), query, (row) => row._rankValues);
};

const searchCustomers = async ({ candidates, query }) => take(candidates.map((row) => ({ type: "customers", id: row._id, title: row.fullName || "Customer", subtitle: row.phone || row.email || "Customer record", metadata: {}, route: route("/dashboard/admin/customers", row.fullName || query), _rankValues: [row.fullName, row.phone, row.email] })), query, (row) => row._rankValues);

const searchBills = async ({ scope, regex, query, customerIds, tableIds }) => {
  const rows = await Bill.find(scoped(scope, { $or: [{ billNumber: regex }, { "allocations.orderNumber": regex }, ...(customerIds.length ? [{ customer: { $in: customerIds } }] : []), ...(tableIds.length ? [{ table: { $in: tableIds } }] : [])] })).select("billNumber status total balanceDue customer table allocations createdAt").populate("table", "tableNumber").sort({ createdAt: -1 }).limit(FETCH_LIMIT).lean();
  return take(rows.map((row) => ({ type: "bills", id: row._id, title: row.billNumber, subtitle: `${title(row.status)} · ₹${Number(row.total || 0).toLocaleString("en-IN")}`, metadata: { status: row.status, amount: row.total }, route: route("/dashboard/admin/billing", row.billNumber), _rankValues: [row.billNumber, ...(row.allocations || []).map((item) => item.orderNumber), row.table?.tableNumber] })), query, (row) => row._rankValues);
};

const searchPayments = async ({ scope, regex, query }) => {
  const rows = await Payment.find(scoped(scope, { $or: [{ paymentId: regex }, { transactionId: regex }] })).select("paymentId paymentStatus paymentMethod totalAmount amount bill orderId createdAt").sort({ createdAt: -1 }).limit(FETCH_LIMIT).lean();
  return take(rows.map((row) => ({ type: "payments", id: row._id, title: row.paymentId, subtitle: `${title(row.paymentMethod)} · ${title(row.paymentStatus)} · ₹${Number(row.totalAmount ?? row.amount ?? 0).toLocaleString("en-IN")}`, metadata: { status: row.paymentStatus, amount: row.totalAmount ?? row.amount }, route: route("/dashboard/admin/payments", row.paymentId), _rankValues: [row.paymentId] })), query, (row) => row._rankValues);
};

const searchTables = async ({ scope, regex, query }) => {
  const rows = await Table.find(scoped(scope, { tableNumber: regex })).select("tableNumber status floor section").sort({ tableNumber: 1 }).limit(FETCH_LIMIT).lean();
  return take(rows.map((row) => ({ type: "tables", id: row._id, title: `Table ${row.tableNumber}`, subtitle: `${title(row.status)}${row.section ? ` · ${row.section}` : ""}`, metadata: { status: row.status }, route: route("/dashboard/admin/tables", row.tableNumber), _rankValues: [row.tableNumber] })), query, (row) => row._rankValues);
};

const searchStaff = async ({ scope, regex, query }) => {
  const rows = await Staff.find(scoped(scope, { $or: [{ firstName: regex }, { lastName: regex }, { employeeId: regex }, { role: regex }] })).select("firstName lastName employeeId role department status").sort({ firstName: 1, lastName: 1 }).limit(FETCH_LIMIT).lean();
  return take(rows.map((row) => ({ type: "staff", id: row._id, title: `${row.firstName || ""} ${row.lastName || ""}`.trim() || row.employeeId, subtitle: `${title(row.role)} · ${title(row.status)}`, metadata: { role: row.role, status: row.status }, route: route("/dashboard/admin/staff", row.employeeId), _rankValues: [row.firstName, row.lastName, row.employeeId, row.role] })), query, (row) => row._rankValues);
};

const searchMenuItems = async ({ scope, regex, query }) => {
  const rows = await Food.find(scoped(scope, { name: regex })).select("name price category isAvailable available").populate("category", "name").sort({ name: 1 }).limit(FETCH_LIMIT).lean();
  return take(rows.map((row) => ({ type: "menuItems", id: row._id, title: row.name, subtitle: `${row.category?.name || "Uncategorized"} · ₹${Number(row.price || 0).toLocaleString("en-IN")} · ${(row.isAvailable ?? row.available) ? "Active" : "Unavailable"}`, metadata: { available: row.isAvailable ?? row.available }, route: route("/dashboard/admin/menu", row.name), _rankValues: [row.name, row.category?.name] })), query, (row) => row._rankValues);
};

const searchKots = async ({ scope, regex, query }) => {
  const rows = await KotTicket.find(scoped(scope, { $or: [{ orderNumber: regex }] })).select("orderNumber status orderType tableId createdAt").populate("tableId", "tableNumber").sort({ createdAt: -1 }).limit(FETCH_LIMIT).lean();
  return take(rows.map((row) => ({ type: "kots", id: row._id, title: `KOT · Order #${row.orderNumber}`, subtitle: `${title(row.status)}${row.tableId?.tableNumber ? ` · Table ${row.tableId.tableNumber}` : ""}`, metadata: { status: row.status }, route: route("/dashboard/admin/kitchen", row.orderNumber), _rankValues: [row.orderNumber, row.tableId?.tableNumber] })), query, (row) => row._rankValues);
};

const searchReservations = async ({ scope, regex, query, customerIds, tableIds }) => {
  const rows = await Reservation.find(scoped(scope, { $or: [...(customerIds.length ? [{ customer: { $in: customerIds } }] : []), ...(tableIds.length ? [{ table: { $in: tableIds } }] : [])] })).select("status date guests customer table").populate("table", "tableNumber").sort({ date: -1 }).limit(FETCH_LIMIT).lean();
  return take(rows.map((row) => ({ type: "reservations", id: row._id, title: row.table?.tableNumber ? `Reservation · Table ${row.table.tableNumber}` : "Reservation", subtitle: `${title(row.status)} · ${new Date(row.date).toLocaleDateString("en-IN")}`, metadata: { status: row.status }, route: route("/reservation", row.table?.tableNumber || query), _rankValues: [row.table?.tableNumber] })), query, (row) => row._rankValues);
};

const searchInventory = async ({ scope, regex, query }) => {
  const rows = await Inventory.find(scoped(scope, { isActive: { $ne: false }, $or: [{ itemName: regex }, { sku: regex }, { category: regex }] })).select("itemName sku quantity unit reorderLevel category").sort({ itemName: 1 }).limit(FETCH_LIMIT).lean();
  return take(rows.map((row) => ({ type: "inventory", id: row._id, title: row.itemName, subtitle: `${row.sku} · ${Number(row.quantity || 0)} ${row.unit || ""} · ${row.category || "Other"}`, metadata: { lowStock: Number(row.quantity || 0) <= Number(row.reorderLevel || 0) }, route: route("/dashboard/admin/inventory", row.sku || row.itemName), _rankValues: [row.itemName, row.sku, row.category] })), query, (row) => row._rankValues);
};

const searchLoyalty = async ({ scope, query, customerIds, customerById }) => {
  if (!customerIds.length) return [];
  const rows = await LoyaltyAccount.find(scoped(scope, { customer: { $in: customerIds }, status: "ACTIVE" })).select("customer currentPoints lastActivityAt").sort({ lastActivityAt: -1 }).limit(FETCH_LIMIT).lean();
  return take(rows.map((row) => ({ type: "loyalty", id: row._id, title: customerById.get(String(row.customer))?.fullName || "Loyalty member", subtitle: `${Number(row.currentPoints || 0)} points`, metadata: {}, route: route("/dashboard/admin/loyalty", customerById.get(String(row.customer))?.fullName || query), _rankValues: [customerById.get(String(row.customer))?.fullName] })), query, (row) => row._rankValues);
};

const searchCentralKitchen = async ({ scope, regex, query }) => {
  const [requisitions, batches, transfers] = await Promise.all([
    CentralKitchenRequisition.find(scoped(scope, { requisitionNumber: regex })).select("requisitionNumber status outlet createdAt").populate("outlet", "name").sort({ createdAt: -1 }).limit(FETCH_LIMIT).lean(),
    ProductionBatch.find(scoped(scope, { batchNumber: regex })).select("batchNumber status outputInventoryItem createdAt").populate("outputInventoryItem", "itemName").sort({ createdAt: -1 }).limit(FETCH_LIMIT).lean(),
    CentralKitchenTransfer.find(scoped(scope, { transferNumber: regex })).select("transferNumber status destinationOutlet createdAt").populate("destinationOutlet", "name").sort({ createdAt: -1 }).limit(FETCH_LIMIT).lean(),
  ]);
  const rows = [
    ...requisitions.map((row) => ({ type: "centralKitchen", id: row._id, title: row.requisitionNumber, subtitle: `Requisition · ${title(row.status)} · ${row.outlet?.name || "Outlet"}`, metadata: { status: row.status }, route: route("/dashboard/admin/central-kitchen", row.requisitionNumber), _rankValues: [row.requisitionNumber] })),
    ...batches.map((row) => ({ type: "centralKitchen", id: row._id, title: row.batchNumber, subtitle: `Production batch · ${title(row.status)} · ${row.outputInventoryItem?.itemName || "Output"}`, metadata: { status: row.status }, route: route("/dashboard/admin/central-kitchen", row.batchNumber), _rankValues: [row.batchNumber] })),
    ...transfers.map((row) => ({ type: "centralKitchen", id: row._id, title: row.transferNumber, subtitle: `Transfer · ${title(row.status)} · ${row.destinationOutlet?.name || "Outlet"}`, metadata: { status: row.status }, route: route("/dashboard/admin/central-kitchen", row.transferNumber), _rankValues: [row.transferNumber] })),
  ];
  return take(rows, query, (row) => row._rankValues);
};

export const globalSearch = async ({ user, query: rawQuery, type, limit }) => {
  const query = normalizeSearchQuery(rawQuery);
  const requestedTypes = normalizeTypes(type);
  const resultTypes = permittedSearchTypes(user).filter((searchType) => !requestedTypes || requestedTypes.has(searchType));
  if (query.length < 2) return { query, results: Object.fromEntries(resultTypes.map((searchType) => [searchType, []])), totalResults: 0, minimumQueryLength: 2 };

  const safeLimit = Math.min(Math.max(Number(limit) || RESULTS_PER_TYPE, 1), RESULTS_PER_TYPE);
  const regex = prefixRegex(query);
  const normalizedPhone = query.replace(/\D/g, "");
  const [scope, restaurantIds] = await Promise.all([buildRestaurantQuery({}, user), getAuthorizedRestaurantIds(user)]);
  const candidates = await findCustomerCandidates({ restaurantIds, regex, normalizedPhone });
  const customerIds = candidates.map((customer) => customer._id);
  const customerById = new Map(candidates.map((customer) => [String(customer._id), customer]));
  const tableCandidates = await findTableCandidates(scope, regex);
  const tableIds = tableCandidates.map((table) => table._id);
  const tasks = {
    orders: () => searchOrders({ scope, regex, query, customerIds, tableIds, deliveryOnly: normalizedRole(user) === "delivery" }),
    onlineOrders: () => searchOrders({ scope, regex, query, customerIds, tableIds, onlineOnly: true, deliveryOnly: normalizedRole(user) === "delivery" }),
    customers: () => searchCustomers({ candidates, query }),
    bills: () => searchBills({ scope, regex, query, customerIds, tableIds }),
    payments: () => searchPayments({ scope, regex, query }),
    tables: () => searchTables({ scope, regex, query }),
    staff: () => searchStaff({ scope, regex, query }),
    menuItems: () => searchMenuItems({ scope, regex, query }),
    kots: () => searchKots({ scope, regex, query }),
    reservations: () => searchReservations({ scope, regex, query, customerIds, tableIds }),
    inventory: () => searchInventory({ scope, regex, query }),
    loyalty: () => searchLoyalty({ scope, query, customerIds, customerById }),
    centralKitchen: () => searchCentralKitchen({ scope, regex, query }),
  };
  const entries = await Promise.all(resultTypes.map(async (searchType) => [searchType, (await tasks[searchType]()).slice(0, safeLimit)]));
  // Object insertion order is preserved by the response and consumed by the
  // grouped command palette, so an exact identifier group appears before a
  // merely-prefix result from an unrelated entity.
  entries.sort(([, left], [, right]) => (right[0]?.relevance || 0) - (left[0]?.relevance || 0));
  const results = Object.fromEntries(entries);
  return { query, results, totalResults: Object.values(results).reduce((total, rows) => total + rows.length, 0), minimumQueryLength: 2 };
};
