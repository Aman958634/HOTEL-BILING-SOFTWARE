import mongoose from "mongoose";
import Restaurant from "../models/Restaurant.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

const IMMUTABLE_FIELDS = ["_id", "id", "createdAt", "updatedAt", "__v"];

const slugify = (value) =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

/** Resolve tenant-scoped query — admin users use JWT restaurant id. */
const getRestaurantQueryForUser = (user) => {
  if (user?.restaurant && mongoose.isValidObjectId(user.restaurant)) {
    return { _id: user.restaurant };
  }
  if (user?.hotelId && mongoose.isValidObjectId(user.hotelId)) {
    return { $or: [{ hotelId: user.hotelId }, { hotelId: null }] };
  }
  return null;
};

const stripImmutableFields = (body = {}) => {
  const payload = { ...body };
  for (const field of IMMUTABLE_FIELDS) {
    delete payload[field];
  }
  return payload;
};

const normalizePayload = (body = {}) => {
  const payload = stripImmutableFields(body);

  if (!payload.name || !String(payload.name).trim()) {
    throw new ApiError(400, "Restaurant name is required");
  }
  if (!payload.branchCode || !String(payload.branchCode).trim()) {
    throw new ApiError(400, "Branch code is required");
  }
  if (!payload.address || !String(payload.address).trim()) {
    throw new ApiError(400, "Address is required");
  }

  payload.name = String(payload.name).trim();
  payload.branchCode = String(payload.branchCode).trim();
  payload.address = String(payload.address).trim();
  payload.city = payload.city ? String(payload.city).trim() : "";
  payload.email = payload.email ? String(payload.email).trim() : "";
  payload.phone = payload.phone ? String(payload.phone).trim() : "";
  payload.gstNumber = payload.gstNumber ? String(payload.gstNumber).trim() : "";
  payload.openingHours = payload.openingHours ? String(payload.openingHours).trim() : "09:00-23:00";
  payload.logoUrl = payload.logoUrl ? String(payload.logoUrl).trim() : "";
  payload.website = payload.website ? String(payload.website).trim() : "";
  payload.isActive = payload.isActive !== undefined ? Boolean(payload.isActive) : true;
  payload.reservationsEnabled =
    payload.reservationsEnabled !== undefined ? Boolean(payload.reservationsEnabled) : true;
  payload.onlineOrdersEnabled =
    payload.onlineOrdersEnabled !== undefined ? Boolean(payload.onlineOrdersEnabled) : true;

  if (!payload.slug || !String(payload.slug).trim()) {
    payload.slug = slugify(payload.name);
  } else {
    payload.slug = slugify(payload.slug);
  }

  if (!payload.slug) {
    throw new ApiError(400, "Invalid restaurant slug");
  }

  return payload;
};

export const getRestaurantSettings = asyncHandler(async (req, res) => {
  const query = getRestaurantQueryForUser(req.user);
  if (!query) {
    throw new ApiError(403, "You do not have permission to access these settings.");
  }

  const restaurant = await Restaurant.findOne(query).sort(req.user?.hotelId ? { hotelId: -1 } : {});
  if (!restaurant) {
    throw new ApiError(404, "Settings not found");
  }

  res.status(200).json(new ApiResponse(true, "Restaurant settings fetched", restaurant));
});

export const updateRestaurantSettings = asyncHandler(async (req, res) => {
  const query = getRestaurantQueryForUser(req.user);
  if (!query) {
    throw new ApiError(403, "You do not have permission to access these settings.");
  }

  const payload = normalizePayload(req.body);

  if (req.user?.hotelId) {
    payload.hotelId = req.user.hotelId;
  }

  let restaurant;

  // Tenant admin: update their own restaurant record (created at signup).
  if (req.user?.restaurant && mongoose.isValidObjectId(req.user.restaurant)) {
    restaurant = await Restaurant.findByIdAndUpdate(req.user.restaurant, payload, {
      new: true,
      runValidators: true,
    });
    if (!restaurant) {
      throw new ApiError(404, "Settings not found");
    }
  } else {
    restaurant = await Restaurant.findOneAndUpdate(query, payload, {
      new: true,
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    });
  }

  res.status(200).json(new ApiResponse(true, "Restaurant settings saved", restaurant));
});

export default {
  getRestaurantSettings,
  updateRestaurantSettings,
};
