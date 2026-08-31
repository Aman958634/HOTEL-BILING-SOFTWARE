import Food from "../models/Food.js";
import Inventory from "../models/Inventory.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";
import { buildOutletQuery, buildRestaurantQuery } from "../utils/tenantUtils.js";
import { getCollectedRevenueSeries, getFinancialMetrics, resolveFinancialRange } from "../services/financialMetricsService.js";

export const dashboardStats = asyncHandler(async (req, res) => {
  // Financial and inventory records are outlet-owned. Menu items are
  // restaurant-owned in the existing schema and use the tenant-only helper.
  const [inventoryScope, foodScope] = await Promise.all([
    buildOutletQuery({}, req.user),
    buildRestaurantQuery({}, req.user),
  ]);

  const chartRange = await resolveFinancialRange({ scope: inventoryScope, range: "last_30_days" });
  const [metrics, foods, inventory, series] = await Promise.all([
    getFinancialMetrics({ scope: inventoryScope }),
    Food.countDocuments(foodScope),
    Inventory.countDocuments(inventoryScope),
    getCollectedRevenueSeries({ scope: inventoryScope, range: chartRange }),
  ]);
  const dailySales = series.slice(-14).map((row) => ({ _id: row.label, amount: row.revenue, orders: row.payments }));

  res.status(200).json(
    new ApiResponse(true, "Dashboard stats", {
      cards: {
        orders: metrics.orders,
        foods,
        inventory,
        revenue: metrics.revenue,
      },
      dailySales,
    })
  );
});
