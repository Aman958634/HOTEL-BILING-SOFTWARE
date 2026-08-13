import Hotel from "../models/Hotel.js";
import Restaurant from "../models/Restaurant.js";
import User from "../models/User.js";
import Order from "../models/Order.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

export const dashboardStats = asyncHandler(async (_req, res) => {
  const [
    totalRestaurants,
    activeRestaurants,
    totalHotels,
    activeHotels,
    totalUsers,
    totalOrders,
    revenueResult,
  ] = await Promise.all([
    Restaurant.countDocuments(),
    Restaurant.countDocuments({ isActive: true }),
    Hotel.countDocuments(),
    Hotel.countDocuments({ status: "active" }),
    User.countDocuments(),
    Order.countDocuments({ isArchived: { $ne: true } }),
    Order.aggregate([
      { $match: { paymentStatus: { $in: ["PAID", "paid"] }, isArchived: { $ne: true } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
  ]);

  const totalRevenue = revenueResult[0]?.total || 0;

  res.status(200).json(
    new ApiResponse(true, "Super admin dashboard stats fetched", {
      totalRestaurants,
      activeRestaurants,
      totalHotels,
      activeHotels,
      totalUsers,
      totalOrders,
      totalRevenue,
    })
  );
});
