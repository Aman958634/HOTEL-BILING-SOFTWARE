import mongoose from "mongoose";
import Table from "../models/Table.js";
import Order from "../models/Order.js";
import Reservation from "../models/Reservation.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getPagination } from "../utils/pagination.js";
import { buildOutletQuery, buildOutletQuery as buildRestaurantQuery } from "../utils/tenantUtils.js";
import {
  TABLE_STATUS,
  activeOrderStatuses,
  activeReservationStatuses,
  normalizeTableStatus,
  updateTableStatus as deriveTableStatus,
} from "../services/tableStateService.js";
import {
  reconcileTablesAvailability,
  findActiveOrdersForTable,
  countActiveOrdersForTable,
} from "../services/tableOrderService.js";

const parseIntOrUndefined = (value) => {
  if (value === undefined || value === null || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
};

const parseDateTime = (date, time) => {
  if (!date || !time) return null;
  const dt = new Date(`${date}T${time}:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const normalizeSortBy = (sortBy) => {
  const allowed = ["tableNumber", "capacity", "status", "floor", "section", "createdAt"];
  return allowed.includes(sortBy) ? sortBy : "tableNumber";
};

const normalizeOrder = (value) => (String(value || "asc").toLowerCase() === "desc" ? -1 : 1);

const buildTableFilters = (query) => {
  const filters = {};

  if (query.search) {
    const search = String(query.search).trim();
    filters.$or = [
      { tableNumber: { $regex: search, $options: "i" } },
      { section: { $regex: search, $options: "i" } },
      { floor: { $regex: search, $options: "i" } },
    ];
  }

  if (query.floor) {
    filters.floor = { $regex: String(query.floor).trim(), $options: "i" };
  }

  if (query.section) {
    filters.section = { $regex: String(query.section).trim(), $options: "i" };
  }

  if (query.status) {
    filters.status = normalizeTableStatus(query.status);
  }

  const capacity = parseIntOrUndefined(query.capacity);
  const minCapacity = parseIntOrUndefined(query.minCapacity);
  const maxCapacity = parseIntOrUndefined(query.maxCapacity);

  if (capacity !== undefined) {
    filters.capacity = { $gte: capacity };
  }

  if (minCapacity !== undefined || maxCapacity !== undefined) {
    filters.capacity = {
      ...(filters.capacity || {}),
      ...(minCapacity !== undefined ? { $gte: minCapacity } : {}),
      ...(maxCapacity !== undefined ? { $lte: maxCapacity } : {}),
    };
  }

  return filters;
};

const tableWithDetailsPopulate = [
  {
    path: "currentOrder",
    select: "orderNumber status total createdAt customer",
    populate: {
      path: "customer",
      select: "fullName email phone",
    },
  },
  {
    path: "currentReservation",
    select: "date guests status customer notes createdAt",
    populate: {
      path: "customer",
      select: "fullName email phone",
    },
  },
];

const findCurrentOrderForTable = async (tableId) =>
  Order.findOne({ table: tableId, status: { $in: activeOrderStatuses } })
    .select("orderNumber status total createdAt customer")
    .populate("customer", "fullName email phone")
    .sort({ createdAt: -1 });

const findCurrentReservationForTable = async (tableId) =>
  Reservation.findOne({ table: tableId, status: { $in: activeReservationStatuses } })
    .select("date guests status customer notes createdAt")
    .populate("customer", "fullName email phone")
    .sort({ date: -1 });

const toPresentation = async (tableDoc) => {
  const table = tableDoc.toObject();

  if (!table.currentOrder) {
    table.currentOrder = await findCurrentOrderForTable(table._id);
  }

  if (!table.currentReservation) {
    table.currentReservation = await findCurrentReservationForTable(table._id);
  }

  const activeOrders = await findActiveOrdersForTable(table._id);
  table.activeOrders = activeOrders;
  table.activeOrderCount = activeOrders.length;

  table.currentCustomer =
    table.currentReservation?.customer || table.currentOrder?.customer || null;

  return table;
};

const ensureUniqueTableNumber = async (tableNumber, restaurant = null, outlet = null, excludeId = null) => {
  const query = {
    tableNumber: {
      $regex: `^${String(tableNumber).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
      $options: "i",
    },
  };

  if (restaurant) {
    query.restaurant = restaurant;
  } else {
    query.restaurant = null;
  }
  if (outlet) query.outlet = outlet;

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const exists = await Table.findOne(query).select("_id");
  if (exists) {
    throw new ApiError(409, "Table number already exists.");
  }
};

export const getTables = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const sortBy = normalizeSortBy(req.query.sortBy);
  const order = normalizeOrder(req.query.order);

  const filters = await buildOutletQuery(buildTableFilters(req.query), req.user);

  const [tables, total] = await Promise.all([
    Table.find(filters)
      .sort({ [sortBy]: order })
      .collation({ locale: "en", numericOrdering: true })
      .skip(skip)
      .limit(limit),
    Table.countDocuments(filters),
  ]);

  // Heal stale OCCUPIED status when no active order remains (keeps Create Order dropdown accurate)
  const healedTables = await reconcileTablesAvailability(tables);

  const tableIds = healedTables.map((table) => table._id);
  const countRows = tableIds.length
    ? await Order.aggregate([
        {
          $match: {
            table: { $in: tableIds },
            isArchived: { $ne: true },
            status: { $in: activeOrderStatuses },
          },
        },
        { $group: { _id: "$table", count: { $sum: 1 } } },
      ])
    : [];
  const countMap = new Map(countRows.map((row) => [String(row._id), row.count]));

  const tablesWithCounts = healedTables.map((table) => {
    const obj = table.toObject();
    obj.activeOrderCount = countMap.get(String(table._id)) || 0;
    return obj;
  });

  res.status(200).json(
    new ApiResponse(true, "Tables fetched", tablesWithCounts, {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    })
  );
});

export const getTableById = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new ApiError(404, "Table not found");
  }

  const table = await Table.findOne(await buildOutletQuery({ _id: req.params.id }, req.user)).populate(tableWithDetailsPopulate);
  if (!table) throw new ApiError(404, "Table not found");

  const data = await toPresentation(table);
  res.status(200).json(new ApiResponse(true, "Table details fetched", data));
});

export const createTable = asyncHandler(async (req, res) => {
  const payload = {
    tableNumber: String(req.body.tableNumber || "").trim(),
    capacity: Number(req.body.capacity),
    floor: String(req.body.floor || "").trim(),
    section: String(req.body.section || "").trim(),
    shape: req.body.shape || "SQUARE",
    description: req.body.description || "",
  };

  if (req.user?.restaurant) {
    payload.restaurant = req.user.restaurant;
    payload.outlet = req.user.activeOutlet || null;
  } else if (req.user?.hotelId) {
    payload.restaurant = null;
  }

  await ensureUniqueTableNumber(payload.tableNumber, payload.restaurant, payload.outlet);

  const table = await Table.create(payload);
  const derivedTable = await deriveTableStatus(table._id);
  res.status(201).json(new ApiResponse(true, "Table created", derivedTable));
});

export const updateTable = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new ApiError(404, "Table not found");
  }

  const table = await Table.findOne(await buildRestaurantQuery({ _id: req.params.id }, req.user));
  if (!table) throw new ApiError(404, "Table not found");

  const updates = {
    ...(req.body.tableNumber !== undefined ? { tableNumber: String(req.body.tableNumber).trim() } : {}),
    ...(req.body.capacity !== undefined ? { capacity: Number(req.body.capacity) } : {}),
    ...(req.body.floor !== undefined ? { floor: String(req.body.floor).trim() } : {}),
    ...(req.body.section !== undefined ? { section: String(req.body.section).trim() } : {}),
    ...(req.body.shape !== undefined ? { shape: req.body.shape } : {}),
    ...(req.body.description !== undefined ? { description: req.body.description } : {}),
  };

  if (updates.tableNumber) {
    await ensureUniqueTableNumber(updates.tableNumber, table.restaurant, table.outlet, table._id);
  }

  Object.assign(table, updates);
  await table.save();

  const populated = await Table.findById(table._id).populate(tableWithDetailsPopulate);
  const data = await toPresentation(populated);
  res.status(200).json(new ApiResponse(true, "Table updated", data));
});

export const deleteTable = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new ApiError(404, "Table not found");
  }

  const table = await Table.findOne(await buildRestaurantQuery({ _id: req.params.id }, req.user));
  if (!table) throw new ApiError(404, "Table not found");

  const [activeOrdersCount, activeReservationsCount] = await Promise.all([
    Order.countDocuments({ table: table._id, status: { $in: activeOrderStatuses } }),
    Reservation.countDocuments({ table: table._id, status: { $in: activeReservationStatuses } }),
  ]);

  if (activeOrdersCount > 0 || activeReservationsCount > 0) {
    throw new ApiError(409, "This table cannot be deleted because it has an active order or reservation.");
  }

  await table.deleteOne();
  res.status(200).json(new ApiResponse(true, "Table deleted"));
});

export const updateTableStatus = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    throw new ApiError(404, "Table not found");
  }

  const table = await Table.findOne(await buildOutletQuery({ _id: req.params.id }, req.user));
  if (!table) throw new ApiError(404, "Table not found");

  const updated = await deriveTableStatus(table._id);
  const populated = await Table.findById(updated._id).populate(tableWithDetailsPopulate);
  const data = await toPresentation(populated);

  res.status(200).json(new ApiResponse(true, "Table status derived", data));
});

export const getTableStats = asyncHandler(async (req, res) => {
  const rows = await Table.aggregate([
    { $match: await buildRestaurantQuery({}, req.user) },
    {
      $project: {
        normalizedStatus: { $toUpper: "$status" },
      },
    },
    {
      $group: {
        _id: "$normalizedStatus",
        count: { $sum: 1 },
      },
    },
  ]);

  const counts = rows.reduce(
    (acc, row) => {
      acc.totalTables += row.count;
      if (row._id === TABLE_STATUS.AVAILABLE) acc.available += row.count;
      if (row._id === TABLE_STATUS.OCCUPIED) acc.occupied += row.count;
      if (row._id === TABLE_STATUS.RESERVED) acc.reserved += row.count;
      if (row._id === TABLE_STATUS.MAINTENANCE) acc.maintenance += row.count;
      return acc;
    },
    {
      totalTables: 0,
      available: 0,
      occupied: 0,
      reserved: 0,
      maintenance: 0,
    }
  );

  res.status(200).json(new ApiResponse(true, "Table statistics fetched", counts));
});

export const getAvailableTables = asyncHandler(async (req, res) => {
  const guests = parseIntOrUndefined(req.query.guests);
  const hasDate = Boolean(req.query.date);
  const hasTime = Boolean(req.query.time);

  if (hasDate !== hasTime) {
    throw new ApiError(422, "Both date and time are required together");
  }

  const reservationDateTime = parseDateTime(req.query.date, req.query.time);

  const filters = {
    status: {
      $nin: reservationDateTime
        ? [TABLE_STATUS.OCCUPIED, TABLE_STATUS.MAINTENANCE, "occupied", "maintenance"]
        : [TABLE_STATUS.OCCUPIED, TABLE_STATUS.MAINTENANCE, TABLE_STATUS.RESERVED, "occupied", "maintenance", "reserved"],
    },
  };

  if (guests !== undefined) {
    filters.capacity = { $gte: guests };
  }

  let reservedTableIds = [];
  if (reservationDateTime) {
    const minuteStart = new Date(reservationDateTime);
    minuteStart.setSeconds(0, 0);

    const minuteEnd = new Date(minuteStart);
    minuteEnd.setMinutes(minuteEnd.getMinutes() + 1);

    const activeReservations = await Reservation.find(
    await buildRestaurantQuery({
      date: { $gte: minuteStart, $lt: minuteEnd },
      status: { $in: activeReservationStatuses },
    }, req.user)
  ).select("table");

    reservedTableIds = activeReservations.map((item) => item.table);
  }

  if (reservedTableIds.length > 0) {
    filters._id = { $nin: reservedTableIds };
  }

  const tables = await Table.find(await buildRestaurantQuery(filters, req.user))
    .sort({ tableNumber: 1 })
    .collation({ locale: "en", numericOrdering: true });

  res.status(200).json(new ApiResponse(true, "Available tables fetched", tables));
});
