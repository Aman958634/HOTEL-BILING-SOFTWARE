import Outlet from "../models/Outlet.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import asyncHandler from "../utils/asyncHandler.js";
import { getAllowedOutlets, resolveAuthorizedOutlet } from "../services/outletService.js";
import { createActivity } from "../services/activityService.js";

const adminOnly = (req) => {
  if (!["admin", "restaurant_admin", "hotel_admin"].includes(String(req.user.role).toLowerCase())) throw new ApiError(403, "Outlet management requires administrator access");
};
export const listMyOutlets = asyncHandler(async (req, res) => res.json(new ApiResponse(true, "Authorized outlets fetched", await getAllowedOutlets(req.user))));
export const listOutlets = asyncHandler(async (req, res) => { adminOnly(req); res.json(new ApiResponse(true, "Outlets fetched", await getAllowedOutlets(req.user, { includeInactive: true }))); });
export const createOutlet = asyncHandler(async (req, res) => { adminOnly(req); const outlet = await Outlet.create({ ...req.body, restaurant: req.user.restaurant, code: String(req.body.code || "").trim().toUpperCase() }); await createActivity({ action: "Outlet Created", description: `Outlet ${outlet.name} created`, performedBy: req.user._id, restaurantId: req.user.restaurant, targetId: outlet._id, targetType: "Outlet" }); res.status(201).json(new ApiResponse(true, "Outlet created", outlet)); });
export const updateOutlet = asyncHandler(async (req, res) => { adminOnly(req); const { restaurant: _restaurant, isDefault: _default, ...updates } = req.body; const outlet = await Outlet.findOneAndUpdate({ _id: req.params.id, restaurant: req.user.restaurant }, { $set: updates }, { new: true, runValidators: true }); if (!outlet) throw new ApiError(404, "Outlet not found"); await createActivity({ action: "Outlet Updated", description: `Outlet ${outlet.name} updated`, performedBy: req.user._id, restaurantId: req.user.restaurant, targetId: outlet._id, targetType: "Outlet" }); res.json(new ApiResponse(true, "Outlet updated", outlet)); });
export const updateOutletStatus = asyncHandler(async (req, res) => { adminOnly(req); const outlet = await Outlet.findOne({ _id: req.params.id, restaurant: req.user.restaurant }); if (!outlet) throw new ApiError(404, "Outlet not found"); if (!req.body.isActive && outlet.isDefault) { const active = await Outlet.countDocuments({ restaurant: req.user.restaurant, isActive: true }); if (active <= 1) throw new ApiError(409, "The final active outlet cannot be deactivated"); } outlet.isActive = Boolean(req.body.isActive); await outlet.save(); await createActivity({ action: outlet.isActive ? "Outlet Reactivated" : "Outlet Deactivated", description: `Outlet ${outlet.name} ${outlet.isActive ? "reactivated" : "deactivated"}`, performedBy: req.user._id, restaurantId: req.user.restaurant, targetId: outlet._id, targetType: "Outlet" }); res.json(new ApiResponse(true, "Outlet status updated", outlet)); });
export const getActiveOutlet = asyncHandler(async (req, res) => res.json(new ApiResponse(true, "Active outlet fetched", await resolveAuthorizedOutlet({ user: req.user, outletId: req.headers["x-outlet-id"] }))));
