import PDFDocument from "pdfkit";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import User from "../models/User.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { normalizePaymentMethod, normalizePaymentStatus } from "../utils/paymentUtils.js";
import { buildRestaurantQuery } from "../utils/tenantUtils.js";
import { calculateGrowth } from "../utils/growthUtils.js";
import orderRepository from "../repositories/orderRepository.js";
import paymentRepository from "../repositories/paymentRepository.js";

const ORDER_STATUSES = ["PENDING", "CONFIRMED", "PREPARING", "READY", "COMPLETED", "CANCELLED"];
const SUCCESS_PAYMENT_STATUSES = ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"];

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
const startOfYear = (date) => new Date(date.getFullYear(), 0, 1);

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const addMonths = (date, months) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};

const startOfWeek = (date) => {
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return startOfDay(addDays(date, diff));
};

const ensureDate = (value, name) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(422, `${name} is invalid`);
  }
  return date;
};

const parseDateRange = (query) => {
  const now = new Date();
  const range = String(query.range || "this_month").toLowerCase();
  let start;
  let end;
  let granularity = "day";

  if (range === "custom") {
    if (!query.startDate || !query.endDate) {
      throw new ApiError(422, "startDate and endDate are required for custom range");
    }
    start = startOfDay(ensureDate(query.startDate, "startDate"));
    const customEnd = ensureDate(query.endDate, "endDate");
    end = addDays(startOfDay(customEnd), 1);

    const diffDays = Math.max(Math.ceil((end - start) / (24 * 60 * 60 * 1000)), 1);
    if (diffDays <= 1) granularity = "hour";
    else if (diffDays >= 365) granularity = "month";
    else granularity = "day";
  } else if (range === "today") {
    start = startOfDay(now);
    end = now;
    granularity = "hour";
  } else if (range === "yesterday") {
    end = startOfDay(now);
    start = addDays(end, -1);
    granularity = "hour";
  } else if (range === "this_week") {
    start = startOfWeek(now);
    end = now;
    granularity = "day";
  } else if (range === "last_week") {
    end = startOfWeek(now);
    start = addDays(end, -7);
    granularity = "day";
  } else if (range === "this_month") {
    start = startOfMonth(now);
    end = now;
    granularity = "day";
  } else if (range === "last_month") {
    end = startOfMonth(now);
    start = addMonths(end, -1);
    granularity = "day";
  } else if (range === "this_year") {
    start = startOfYear(now);
    end = now;
    granularity = "month";
  } else {
    throw new ApiError(422, "Invalid date range");
  }

  if (start >= end) {
    throw new ApiError(422, "Date range is invalid");
  }

  const previousEnd = new Date(start);
  const previousStart = new Date(start.getTime() - (end.getTime() - start.getTime()));

  return {
    range,
    start,
    end,
    previousStart,
    previousEnd,
    granularity,
  };
};

const growthPercent = (current, previous) => calculateGrowth(current, previous);

const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const escapeCsv = (value) => {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
};

const formatInr = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(new Date(value))
    : "-";

const toOrderMatch = (rangeContext, restaurantFilter = {}) => ({
  ...restaurantFilter,
  isArchived: { $ne: true },
  createdAt: { $gte: rangeContext.start, $lt: rangeContext.end },
});

const toPaymentMatch = (rangeContext, restaurantFilter = {}) => ({
  ...restaurantFilter,
  createdAt: { $gte: rangeContext.start, $lt: rangeContext.end },
});

const getRestaurantFilter = async (user) => {
  if (!user) return {};
  return buildRestaurantQuery({}, user);
};

const buildSummaryForRange = async (rangeContext, restaurantFilter = {}) => {
  const orderMatch = toOrderMatch(rangeContext, restaurantFilter);
  const paymentMatch = {
    ...toPaymentMatch(rangeContext, restaurantFilter),
    paymentStatus: { $in: SUCCESS_PAYMENT_STATUSES },
  };

  const [
    orderStatusRows,
    totalOrders,
    uniqueCustomers,
    revenueAgg,
  ] = await Promise.all([
    orderRepository.aggregate(null, [
      { $match: orderMatch },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    orderRepository.count(null, orderMatch),
    Order.distinct("customer", { ...orderMatch, customer: { $ne: null } }),
    paymentRepository.aggregate(null, [
      { $match: paymentMatch },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $subtract: ["$totalAmount", { $ifNull: ["$refundAmount", 0] }] } },
        },
      },
    ]),
  ]);

  const statusMap = orderStatusRows.reduce((acc, row) => {
    acc[String(row._id || "").toUpperCase()] = row.count;
    return acc;
  }, {});

  const completedOrders = statusMap.COMPLETED || 0;
  const cancelledOrders = statusMap.CANCELLED || 0;
  const revenue = Number(revenueAgg[0]?.totalRevenue || 0);
  const averageOrderValue = completedOrders ? revenue / completedOrders : 0;

  return {
    totalRevenue: revenue,
    totalOrders,
    averageOrderValue,
    totalCustomers: uniqueCustomers.length,
    completedOrders,
    cancelledOrders,
  };
};

export const getReportSummary = asyncHandler(async (req, res) => {
  const current = parseDateRange(req.query);
  const previous = {
    ...current,
    start: current.previousStart,
    end: current.previousEnd,
  };

  const restaurantFilter = await getRestaurantFilter(req.user);

  const [currentSummary, previousSummary] = await Promise.all([
    buildSummaryForRange(current, restaurantFilter),
    buildSummaryForRange(previous, restaurantFilter),
  ]);

  const data = {
    ...currentSummary,
    growth: {
      totalRevenue: growthPercent(currentSummary.totalRevenue, previousSummary.totalRevenue),
      totalOrders: growthPercent(currentSummary.totalOrders, previousSummary.totalOrders),
      averageOrderValue: growthPercent(currentSummary.averageOrderValue, previousSummary.averageOrderValue),
      totalCustomers: growthPercent(currentSummary.totalCustomers, previousSummary.totalCustomers),
      completedOrders: growthPercent(currentSummary.completedOrders, previousSummary.completedOrders),
      cancelledOrders: growthPercent(currentSummary.cancelledOrders, previousSummary.cancelledOrders),
    },
    previousPeriod: previousSummary,
  };

  res.status(200).json(new ApiResponse(true, "Report summary fetched", data));
});

export const getRevenueReport = asyncHandler(async (req, res) => {
  const rangeContext = parseDateRange(req.query);
  const restaurantFilter = await getRestaurantFilter(req.user);
  const format =
    rangeContext.granularity === "hour"
      ? "%Y-%m-%d %H:00"
      : rangeContext.granularity === "month"
        ? "%Y-%m"
        : "%Y-%m-%d";

  const rows = await paymentRepository.aggregate(null, [
    {
      $match: {
        ...toPaymentMatch(rangeContext, restaurantFilter),
        paymentStatus: { $in: SUCCESS_PAYMENT_STATUSES },
      },
    },
    {
      $group: {
        _id: { $dateToString: { format, date: "$createdAt" } },
        revenue: { $sum: { $subtract: ["$totalAmount", { $ifNull: ["$refundAmount", 0] }] } },
        payments: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const totalRevenue = rows.reduce((sum, row) => sum + Number(row.revenue || 0), 0);

  res.status(200).json(
    new ApiResponse(true, "Revenue report fetched", {
      granularity: rangeContext.granularity,
      totalRevenue,
      points: rows.map((row) => ({ label: row._id, revenue: Number(row.revenue || 0), payments: row.payments })),
    })
  );
});

export const getOrdersReport = asyncHandler(async (req, res) => {
  const rangeContext = parseDateRange(req.query);
  const restaurantFilter = await getRestaurantFilter(req.user);
  const rows = await orderRepository.aggregate(null, [
    { $match: toOrderMatch(rangeContext, restaurantFilter) },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  const statusCounts = ORDER_STATUSES.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {});

  rows.forEach((row) => {
    statusCounts[String(row._id || "").toUpperCase()] = row.count;
  });

  const totalOrders = Object.values(statusCounts).reduce((sum, value) => sum + Number(value || 0), 0);
  const statusBreakdown = ORDER_STATUSES.map((status) => {
    const count = statusCounts[status] || 0;
    const percent = totalOrders ? Number(((count / totalOrders) * 100).toFixed(2)) : 0;
    return { status, count, percent };
  });

  res.status(200).json(
    new ApiResponse(true, "Orders report fetched", {
      totalOrders,
      statusBreakdown,
      completed: statusCounts.COMPLETED || 0,
      pending: (statusCounts.PENDING || 0) + (statusCounts.CONFIRMED || 0),
      preparing: statusCounts.PREPARING || 0,
      ready: statusCounts.READY || 0,
      cancelled: statusCounts.CANCELLED || 0,
    })
  );
});

export const getTopItemsReport = asyncHandler(async (req, res) => {
  const rangeContext = parseDateRange(req.query);
  const restaurantFilter = await getRestaurantFilter(req.user);
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 20);

  const rows = await orderRepository.aggregate(null, [
    {
      $match: {
        ...toOrderMatch(rangeContext, restaurantFilter),
        paymentStatus: { $in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] },
      },
    },
    { $unwind: "$items" },
    {
      $lookup: {
        from: "foods",
        localField: "items.menuItem",
        foreignField: "_id",
        as: "food",
      },
    },
    { $unwind: { path: "$food", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "categories",
        localField: "food.category",
        foreignField: "_id",
        as: "category",
      },
    },
    { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: {
          menuItem: "$items.menuItem",
          name: "$items.name",
          category: "$category.name",
        },
        quantitySold: { $sum: "$items.quantity" },
        revenue: { $sum: "$items.subtotal" },
        orders: { $addToSet: "$_id" },
      },
    },
    {
      $project: {
        _id: 0,
        itemName: "$_id.name",
        category: { $ifNull: ["$_id.category", "Uncategorized"] },
        quantitySold: 1,
        revenue: 1,
        orders: { $size: "$orders" },
      },
    },
    { $sort: { revenue: -1, quantitySold: -1 } },
    { $limit: limit },
  ]);

  res.status(200).json(
    new ApiResponse(
      true,
      "Top selling items fetched",
      rows.map((row, index) => ({ rank: index + 1, ...row }))
    )
  );
});

export const getCategoryReport = asyncHandler(async (req, res) => {
  const rangeContext = parseDateRange(req.query);
  const restaurantFilter = await getRestaurantFilter(req.user);

  const rows = await orderRepository.aggregate(null, [
    {
      $match: {
        ...toOrderMatch(rangeContext, restaurantFilter),
        paymentStatus: { $in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] },
      },
    },
    { $unwind: "$items" },
    {
      $lookup: {
        from: "foods",
        localField: "items.menuItem",
        foreignField: "_id",
        as: "food",
      },
    },
    { $unwind: { path: "$food", preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: "categories",
        localField: "food.category",
        foreignField: "_id",
        as: "category",
      },
    },
    { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: { category: "$category.name" },
        orders: { $addToSet: "$_id" },
        itemsSold: { $sum: "$items.quantity" },
        revenue: { $sum: "$items.subtotal" },
      },
    },
    {
      $project: {
        _id: 0,
        category: { $ifNull: ["$_id.category", "Uncategorized"] },
        orders: { $size: "$orders" },
        itemsSold: 1,
        revenue: 1,
      },
    },
    { $sort: { revenue: -1 } },
  ]);

  const totalRevenue = rows.reduce((sum, row) => sum + Number(row.revenue || 0), 0);
  const data = rows.map((row) => ({
    ...row,
    salesPercent: totalRevenue ? Number(((Number(row.revenue || 0) / totalRevenue) * 100).toFixed(2)) : 0,
  }));

  res.status(200).json(new ApiResponse(true, "Category performance fetched", data));
});

export const getPaymentReport = asyncHandler(async (req, res) => {
  const rangeContext = parseDateRange(req.query);
  const restaurantFilter = await getRestaurantFilter(req.user);
  const match = toPaymentMatch(rangeContext, restaurantFilter);

  const [statusRows, methodRows, totalCount] = await Promise.all([
    paymentRepository.aggregate(null, [
      { $match: match },
      { $group: { _id: "$paymentStatus", count: { $sum: 1 } } },
    ]),
    paymentRepository.aggregate(null, [
      { $match: match },
      { $group: { _id: "$paymentMethod", count: { $sum: 1 }, totalAmount: { $sum: "$totalAmount" } } },
      { $sort: { totalAmount: -1 } },
    ]),
    paymentRepository.count(null, match),
  ]);

  const statusMap = statusRows.reduce((acc, row) => {
    acc[normalizePaymentStatus(row._id)] = row.count;
    return acc;
  }, {});

  const summary = {
    totalPayments: totalCount,
    successfulPayments: statusMap.PAID || 0,
    pendingPayments: (statusMap.PENDING || 0) + (statusMap.PROCESSING || 0),
    failedPayments: statusMap.FAILED || 0,
    refundedPayments: (statusMap.REFUNDED || 0) + (statusMap.PARTIALLY_REFUNDED || 0),
  };

  const methods = methodRows.map((row) => ({
    method: normalizePaymentMethod(row._id),
    count: row.count,
    totalAmount: Number(row.totalAmount || 0),
  }));

  res.status(200).json(new ApiResponse(true, "Payment report fetched", { summary, methods }));
});

export const getCustomerReport = asyncHandler(async (req, res) => {
  const rangeContext = parseDateRange(req.query);
  const restaurantFilter = await getRestaurantFilter(req.user);

  const [customersInPeriod, firstOrderRows] = await Promise.all([
    orderRepository.aggregate(null, [
      {
        $match: {
          ...toOrderMatch(rangeContext, restaurantFilter),
          customer: { $ne: null },
        },
      },
      {
        $group: {
          _id: "$customer",
          orders: { $sum: 1 },
          spend: {
            $sum: {
              $cond: [{ $in: ["$paymentStatus", ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"]] }, "$total", 0],
            },
          },
        },
      },
    ]),
    orderRepository.aggregate(null, [
      {
        $match: {
          ...restaurantFilter,
          isArchived: { $ne: true },
          customer: { $ne: null },
        },
      },
      {
        $group: {
          _id: "$customer",
          firstOrderAt: { $min: "$createdAt" },
        },
      },
    ]),
  ]);

  const firstOrderMap = firstOrderRows.reduce((acc, row) => {
    acc[String(row._id)] = row.firstOrderAt;
    return acc;
  }, {});

  let newCustomers = 0;
  let totalOrders = 0;
  let totalSpend = 0;

  customersInPeriod.forEach((row) => {
    totalOrders += Number(row.orders || 0);
    totalSpend += Number(row.spend || 0);
    const firstOrderAt = firstOrderMap[String(row._id)];
    if (firstOrderAt && firstOrderAt >= rangeContext.start && firstOrderAt < rangeContext.end) {
      newCustomers += 1;
    }
  });

  const totalCustomers = customersInPeriod.length;
  const returningCustomers = Math.max(totalCustomers - newCustomers, 0);

  const data = {
    totalCustomers,
    newCustomers,
    returningCustomers,
    averageOrdersPerCustomer: totalCustomers ? Number((totalOrders / totalCustomers).toFixed(2)) : 0,
    averageCustomerSpend: totalCustomers ? Number((totalSpend / totalCustomers).toFixed(2)) : 0,
  };

  res.status(200).json(new ApiResponse(true, "Customer analytics fetched", data));
});

export const getSalesReport = asyncHandler(async (req, res) => {
  const rangeContext = parseDateRange(req.query);
  const restaurantFilter = await getRestaurantFilter(req.user);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
  const skip = (page - 1) * limit;
  const search = String(req.query.search || "").trim();
  const orderStatus = req.query.orderStatus ? String(req.query.orderStatus).toUpperCase() : "";
  const paymentStatus = req.query.paymentStatus ? normalizePaymentStatus(req.query.paymentStatus) : "";
  const sortBy = String(req.query.sortBy || "date").toLowerCase();
  const sortOrder = String(req.query.sortOrder || "desc").toLowerCase() === "asc" ? 1 : -1;

  const baseMatch = toOrderMatch(rangeContext, restaurantFilter);
  if (orderStatus) baseMatch.status = orderStatus;
  if (paymentStatus) baseMatch.paymentStatus = paymentStatus;

  const pipeline = [
    { $match: baseMatch },
    {
      $lookup: {
        from: "users",
        localField: "customer",
        foreignField: "_id",
        as: "customer",
      },
    },
    { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        customerName: { $ifNull: ["$customer.fullName", "Guest"] },
        customerPhone: { $ifNull: ["$customer.phone", ""] },
        itemsCount: {
          $sum: {
            $map: {
              input: "$items",
              as: "item",
                in: "$$item.quantity",
            },
          },
        },
      },
    },
  ];

  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    pipeline.push({
      $match: {
        $or: [{ orderNumber: regex }, { customerName: regex }, { customerPhone: regex }],
      },
    });
  }

  const sort =
    sortBy === "revenue"
      ? { total: sortOrder, createdAt: -1 }
      : { createdAt: sortOrder };

  pipeline.push(
    { $sort: sort },
    {
      $project: {
        _id: 1,
        orderNumber: 1,
        createdAt: 1,
        customerName: 1,
        itemsCount: 1,
        subtotal: 1,
        discount: 1,
        tax: 1,
        total: 1,
        paymentMethod: 1,
        paymentStatus: 1,
        status: 1,
      },
    },
    {
      $facet: {
        data: [{ $skip: skip }, { $limit: limit }],
        meta: [{ $count: "total" }],
      },
    }
  );

  const [result] = await orderRepository.aggregate(null, pipeline);
  const data = result?.data || [];
  const total = result?.meta?.[0]?.total || 0;

  res.status(200).json(
    new ApiResponse(true, "Sales report fetched", data, {
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    })
  );
});

const buildExportPayload = async (query, user) => {
  const rangeContext = parseDateRange(query);
  const restaurantFilter = await getRestaurantFilter(user);
  const [summaryRes, revenueRes, topItemsRes, paymentRes, salesRes] = await Promise.all([
    (async () => {
      const current = await buildSummaryForRange(rangeContext, restaurantFilter);
      const previous = await buildSummaryForRange(
        { ...rangeContext, start: rangeContext.previousStart, end: rangeContext.previousEnd },
        restaurantFilter
      );
      return {
        ...current,
        growth: {
          totalRevenue: growthPercent(current.totalRevenue, previous.totalRevenue),
          totalOrders: growthPercent(current.totalOrders, previous.totalOrders),
          averageOrderValue: growthPercent(current.averageOrderValue, previous.averageOrderValue),
          totalCustomers: growthPercent(current.totalCustomers, previous.totalCustomers),
        },
      };
    })(),
    (async () => {
      const format =
        rangeContext.granularity === "hour"
          ? "%Y-%m-%d %H:00"
          : rangeContext.granularity === "month"
            ? "%Y-%m"
            : "%Y-%m-%d";
      return paymentRepository.aggregate(null, [
        {
          $match: {
            ...toPaymentMatch(rangeContext, restaurantFilter),
            paymentStatus: { $in: SUCCESS_PAYMENT_STATUSES },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format, date: "$createdAt" } },
            revenue: { $sum: { $subtract: ["$totalAmount", { $ifNull: ["$refundAmount", 0] }] } },
          },
        },
        { $sort: { _id: 1 } },
      ]);
    })(),
    (async () => {
      return orderRepository.aggregate(null, [
        {
          $match: {
            ...toOrderMatch(rangeContext, restaurantFilter),
            paymentStatus: { $in: ["PAID", "PARTIALLY_REFUNDED", "REFUNDED"] },
          },
        },
        { $unwind: "$items" },
        {
          $lookup: {
            from: "foods",
            localField: "items.menuItem",
            foreignField: "_id",
            as: "food",
          },
        },
        { $unwind: { path: "$food", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "categories",
            localField: "food.category",
            foreignField: "_id",
            as: "category",
          },
        },
        { $unwind: { path: "$category", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { name: "$items.name", category: "$category.name" },
            quantitySold: { $sum: "$items.quantity" },
            revenue: { $sum: "$items.subtotal" },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: 10 },
      ]);
    })(),
    (async () => {
      const [statusRows, methodRows] = await Promise.all([
        paymentRepository.aggregate(null, [
          { $match: toPaymentMatch(rangeContext, restaurantFilter) },
          { $group: { _id: "$paymentStatus", count: { $sum: 1 } } },
        ]),
        paymentRepository.aggregate(null, [
          { $match: toPaymentMatch(rangeContext, restaurantFilter) },
          { $group: { _id: "$paymentMethod", count: { $sum: 1 }, totalAmount: { $sum: "$totalAmount" } } },
          { $sort: { totalAmount: -1 } },
        ]),
      ]);
      return { statusRows, methodRows };
    })(),
    (async () => {
      return orderRepository.aggregate(null, [
        { $match: toOrderMatch(rangeContext, restaurantFilter) },
        {
          $lookup: {
            from: "users",
            localField: "customer",
            foreignField: "_id",
            as: "customer",
          },
        },
        { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            orderNumber: 1,
            createdAt: 1,
            customerName: { $ifNull: ["$customer.fullName", "Guest"] },
            itemsCount: {
              $sum: {
                $map: {
                  input: "$items",
                  as: "item",
                  in: "$$item.quantity",
                },
              },
            },
            subtotal: 1,
            discount: 1,
            tax: 1,
            total: 1,
            paymentMethod: 1,
            paymentStatus: 1,
            status: 1,
          },
        },
        { $sort: { createdAt: -1 } },
        { $limit: 200 },
      ]);
    })(),
  ]);

  return {
    rangeContext,
    summary: summaryRes,
    revenue: revenueRes,
    topItems: topItemsRes,
    payments: paymentRes,
    sales: salesRes,
  };
};

const buildReportCsv = (payload) => {
  const { rangeContext, summary, topItems, payments, sales } = payload;
  const lines = [];

  lines.push(["RestoSphere Reports Export"]);
  lines.push([`Range`, `${rangeContext.start.toISOString()} to ${rangeContext.end.toISOString()}`]);
  lines.push([]);

  lines.push(["Summary"]);
  lines.push(["Total Revenue", summary.totalRevenue]);
  lines.push(["Total Orders", summary.totalOrders]);
  lines.push(["Average Order Value", summary.averageOrderValue]);
  lines.push(["Total Customers", summary.totalCustomers]);
  lines.push(["Completed Orders", summary.completedOrders]);
  lines.push(["Cancelled Orders", summary.cancelledOrders]);
  lines.push([]);

  lines.push(["Top Selling Items"]);
  lines.push(["Item", "Category", "Quantity Sold", "Revenue"]);
  topItems.forEach((item) => {
    lines.push([item._id?.name || item.itemName || "Item", item._id?.category || item.category || "Uncategorized", item.quantitySold, item.revenue]);
  });
  lines.push([]);

  lines.push(["Payment Summary"]);
  lines.push(["Status", "Count"]);
  payments.statusRows.forEach((row) => {
    lines.push([row._id, row.count]);
  });
  lines.push([]);
  lines.push(["Payment Methods", "Count", "Amount"]);
  payments.methodRows.forEach((row) => {
    lines.push([row._id, row.count, row.totalAmount]);
  });
  lines.push([]);

  lines.push(["Sales Table"]);
  lines.push(["Order ID", "Date", "Customer", "Items", "Subtotal", "Discount", "Tax", "Total", "Payment Method", "Payment Status", "Order Status"]);
  sales.forEach((row) => {
    lines.push([
      row.orderNumber,
      formatDate(row.createdAt),
      row.customerName,
      row.itemsCount,
      row.subtotal,
      row.discount,
      row.tax,
      row.total,
      row.paymentMethod,
      row.paymentStatus,
      row.status,
    ]);
  });

  return lines.map((row) => row.map(escapeCsv).join(",")).join("\n");
};

const buildReportPdfBuffer = async (payload) =>
  new Promise((resolve) => {
    const { rangeContext, summary, topItems, payments, sales } = payload;
    const doc = new PDFDocument({ margin: 36, size: "A4" });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    doc.rect(0, 0, doc.page.width, 70).fill("#0f766e");
    doc.fillColor("white").fontSize(20).font("Helvetica-Bold").text("RestoSphere Reports", 36, 25);

    doc.fillColor("#0f172a").moveDown(3);
    doc.fontSize(10).font("Helvetica").text(`Range: ${formatDate(rangeContext.start)} to ${formatDate(addDays(rangeContext.end, -1))}`);
    doc.moveDown(0.8);

    doc.fontSize(13).font("Helvetica-Bold").text("Summary");
    doc.moveDown(0.3);
    const summaryRows = [
      ["Total Revenue", formatInr(summary.totalRevenue)],
      ["Total Orders", summary.totalOrders],
      ["Average Order Value", formatInr(summary.averageOrderValue)],
      ["Total Customers", summary.totalCustomers],
      ["Completed Orders", summary.completedOrders],
      ["Cancelled Orders", summary.cancelledOrders],
    ];
    summaryRows.forEach(([label, value]) => {
      doc.fontSize(10).font("Helvetica").text(`${label}: ${value}`);
    });

    doc.moveDown(0.8);
    doc.fontSize(13).font("Helvetica-Bold").text("Top Selling Items");
    doc.moveDown(0.3);
    topItems.forEach((item, index) => {
      const name = item._id?.name || item.itemName || "Item";
      const category = item._id?.category || item.category || "Uncategorized";
      doc
        .fontSize(10)
        .font("Helvetica")
        .text(`#${index + 1} ${name} (${category}) - Qty ${item.quantitySold}, Revenue ${formatInr(item.revenue)}`);
    });

    doc.moveDown(0.8);
    doc.fontSize(13).font("Helvetica-Bold").text("Payment Summary");
    doc.moveDown(0.3);
    payments.statusRows.forEach((row) => {
      doc.fontSize(10).font("Helvetica").text(`${row._id}: ${row.count}`);
    });

    doc.moveDown(0.8);
    doc.fontSize(13).font("Helvetica-Bold").text("Sales (Latest 200)");
    doc.moveDown(0.3);

    sales.slice(0, 30).forEach((row) => {
      doc
        .fontSize(9)
        .font("Helvetica")
        .text(`${row.orderNumber} | ${formatDate(row.createdAt)} | ${row.customerName} | ${formatInr(row.total)} | ${row.paymentStatus} | ${row.status}`);
    });

    if (sales.length > 30) {
      doc.moveDown(0.3).fontSize(9).font("Helvetica-Oblique").text(`...${sales.length - 30} more rows in CSV export`);
    }

    doc.end();
  });

export const exportReports = asyncHandler(async (req, res) => {
  const format = String(req.query.format || "csv").toLowerCase();
  if (!["csv", "pdf"].includes(format)) {
    throw new ApiError(422, "format must be csv or pdf");
  }

  const payload = await buildExportPayload(req.query, req.user);

  if (format === "pdf") {
    const buffer = await buildReportPdfBuffer(payload);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=reports-export.pdf");
    res.status(200).send(buffer);
    return;
  }

  const csv = buildReportCsv(payload);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=reports-export.csv");
  res.status(200).send(csv);
});
