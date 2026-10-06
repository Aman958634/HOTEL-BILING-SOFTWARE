import mongoose from "mongoose";
import logger from "../utils/logger.js";

const HEADER = "========================================\nORDER NUMBER MIGRATION READ-ONLY PREFLIGHT\n========================================";
const FOOTER = "========================================";
const EXPECTED_SCOPED_ORDER_INDEX = { restaurant: 1, orderNumber: 1 };
const EXPECTED_SCOPED_ORDER_PARTIAL = { restaurant: { $type: "objectId" } };
let startupPreflightRan = false;

const isSame = (left, right) => JSON.stringify(left || null) === JSON.stringify(right || null);
const countResult = (rows) => Number(rows[0]?.count || 0);
const yesNo = (value) => (value ? "YES" : "NO");
const missingField = (field) => ({ $expr: { $eq: [{ $type: `$${field}` }, "missing"] } });
const typedField = (field, type) => ({ $expr: { $eq: [{ $type: `$${field}` }, type] } });
const hasIndex = (indexes, key, predicate = () => true) => indexes.some((index) => isSame(index.key, key) && predicate(index));

export const isOrderNumberPreflightEnabled = (value = process.env.ORDER_NUMBER_PREFLIGHT) => (
  String(value || "").trim().toLowerCase() === "true"
);

const logBlock = ({ report, blocker }) => [
  HEADER,
  "MODE: READ ONLY",
  `TOTAL ORDERS: ${report?.totalOrders ?? "UNVERIFIED"}`,
  `RESTAURANT-SCOPED ORDERS: ${report?.restaurantScopedOrders ?? "UNVERIFIED"}`,
  `DUPLICATE RESTAURANT+ORDERNUMBER GROUPS: ${report?.duplicateRestaurantOrderNumberGroups ?? "UNVERIFIED"}`,
  `MISSING ORDERNUMBER: ${report?.missingOrderNumber ?? "UNVERIFIED"}`,
  `NULL ORDERNUMBER: ${report?.nullOrderNumber ?? "UNVERIFIED"}`,
  `EMPTY ORDERNUMBER: ${report?.emptyOrderNumber ?? "UNVERIFIED"}`,
  `MISSING/INVALID RESTAURANT: ${report?.missingOrInvalidRestaurant ?? "UNVERIFIED"}`,
  `LEGACY GLOBAL ORDER INDEX PRESENT: ${yesNo(report?.legacyGlobalOrderIndexPresent)}`,
  `SCOPED ORDER INDEX PRESENT: ${yesNo(report?.scopedOrderIndexPresent)}`,
  `LEGACY GLOBAL COUNTER INDEX PRESENT: ${yesNo(report?.legacyGlobalCounterIndexPresent)}`,
  `LEGACY COUNTER RECORDS: ${report?.legacyCounterRecords ?? "UNVERIFIED"}`,
  `SCOPED COUNTER RECORDS: ${report?.scopedCounterRecords ?? "UNVERIFIED"}`,
  `PREFLIGHT: ${blocker === "NONE" ? "PASS" : "FAIL"}`,
  `BLOCKER: ${blocker}`,
  "PRODUCTION DATA MODIFIED: NO",
  "INDEX MODIFIED: NO",
  "COUNTER MODIFIED: NO",
  "MIGRATION EXECUTED: NO",
  FOOTER,
].join("\n");

/**
 * This deliberately uses only countDocuments, aggregate, and listIndexes on
 * the existing application connection. It has no model, index, or migration
 * imports and cannot issue a write operation.
 */
export const runOrderNumberMigrationPreflight = async ({ connection = mongoose.connection, log = logger } = {}) => {
  if (!connection?.db) throw new Error("MongoDB connection is not ready for the read-only order-number preflight.");

  const orders = connection.db.collection("orders");
  const counters = connection.db.collection("counters");
  const restaurantObjectId = { restaurant: { $type: "objectId" } };
  const invalidRestaurant = {
    $and: [
      { $expr: { $ne: [{ $type: "$restaurant" }, "objectId"] } },
      { $expr: { $ne: [{ $type: "$restaurant" }, "missing"] } },
    ],
  };

  const [
    totalOrders,
    restaurantScopedOrders,
    missingRestaurants,
    invalidRestaurants,
    missingOrderNumber,
    nullOrderNumber,
    emptyOrderNumber,
    duplicateOrderGroups,
    orderIndexes,
    counterIndexes,
    legacyCounterRecords,
    scopedCounterRecords,
    duplicateCounterGroups,
  ] = await Promise.all([
    orders.countDocuments({}),
    orders.countDocuments(restaurantObjectId),
    orders.countDocuments(missingField("restaurant")),
    orders.countDocuments(invalidRestaurant),
    orders.countDocuments({ ...restaurantObjectId, ...missingField("orderNumber") }),
    orders.countDocuments({ ...restaurantObjectId, ...typedField("orderNumber", "null") }),
    orders.countDocuments({ ...restaurantObjectId, orderNumber: "" }),
    orders.aggregate([
      { $match: restaurantObjectId },
      { $group: { _id: { restaurant: "$restaurant", orderNumber: "$orderNumber" }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $count: "count" },
    ]).toArray(),
    orders.listIndexes().toArray(),
    counters.listIndexes().toArray(),
    counters.countDocuments({ key: "orderNumber", $expr: { $ne: [{ $type: "$restaurant" }, "objectId"] } }),
    counters.countDocuments({ key: "orderNumber", restaurant: { $type: "objectId" } }),
    counters.aggregate([
      { $group: { _id: { key: "$key", restaurant: "$restaurant" }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $count: "count" },
    ]).toArray(),
  ]);

  const report = {
    totalOrders,
    restaurantScopedOrders,
    missingOrInvalidRestaurant: missingRestaurants + invalidRestaurants,
    missingOrderNumber,
    nullOrderNumber,
    emptyOrderNumber,
    duplicateRestaurantOrderNumberGroups: countResult(duplicateOrderGroups),
    legacyGlobalOrderIndexPresent: hasIndex(orderIndexes, { orderNumber: 1 }, (index) => index.unique === true),
    scopedOrderIndexPresent: hasIndex(orderIndexes, EXPECTED_SCOPED_ORDER_INDEX, (index) => (
      index.unique === true && isSame(index.partialFilterExpression, EXPECTED_SCOPED_ORDER_PARTIAL)
    )),
    legacyGlobalCounterIndexPresent: hasIndex(counterIndexes, { key: 1 }, (index) => index.unique === true),
    legacyCounterRecords,
    scopedCounterRecords,
    duplicateCounterGroups: countResult(duplicateCounterGroups),
  };

  const blocker = report.duplicateRestaurantOrderNumberGroups
    ? "Duplicate restaurant-scoped order-number groups would prevent the unique index."
    : report.duplicateCounterGroups
      ? "Duplicate Counter key+restaurant groups would prevent the required unique counter index."
      : "NONE";

  log.info(logBlock({ report, blocker }));
  return { report, pass: blocker === "NONE", blocker };
};

export const runOrderNumberMigrationPreflightIfEnabled = async (options = {}) => {
  if (!isOrderNumberPreflightEnabled(options.enabled)) return { executed: false };
  if (startupPreflightRan) return { executed: false, alreadyStarted: true };

  startupPreflightRan = true;
  try {
    const result = await runOrderNumberMigrationPreflight(options);
    return { executed: true, ...result };
  } catch (_error) {
    const blocker = "Read-only preflight could not complete; review protected server logs and MongoDB connectivity.";
    (options.log || logger).info(logBlock({ blocker }));
    return { executed: true, pass: false, blocker };
  }
};
