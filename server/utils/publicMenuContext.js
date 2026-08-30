import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Table from "../models/Table.js";
import Outlet from "../models/Outlet.js";
import Restaurant from "../models/Restaurant.js";
import ApiError from "./ApiError.js";

const CONTEXT_TYPE = "public_menu_table";
const contextError = (message, code = "PUBLIC_MENU_CONTEXT_INVALID") => new ApiError(400, message, code);

const getSecret = () => {
  if (process.env.PUBLIC_MENU_CONTEXT_SECRET) return process.env.PUBLIC_MENU_CONTEXT_SECRET;
  if (process.env.NODE_ENV !== "production" && process.env.JWT_ACCESS_SECRET) return process.env.JWT_ACCESS_SECRET;
  throw new ApiError(503, "Public menu QR signing is not configured", "PUBLIC_MENU_CONTEXT_UNAVAILABLE");
};

export const createPublicMenuContext = (table) => {
  if (!table?.restaurant || !table?.outlet) {
    throw new ApiError(409, "Table must belong to an active outlet before a QR code can be generated", "PUBLIC_MENU_CONTEXT_INCOMPLETE");
  }

  return jwt.sign(
    {
      type: CONTEXT_TYPE,
      tableId: String(table._id),
      restaurantId: String(table.restaurant),
      outletId: String(table.outlet),
    },
    getSecret(),
    { expiresIn: process.env.PUBLIC_MENU_CONTEXT_EXPIRES || "365d" }
  );
};

export const resolvePublicMenuContext = async (token) => {
  if (!token || typeof token !== "string") {
    throw contextError("A valid table QR context is required", "PUBLIC_MENU_CONTEXT_REQUIRED");
  }

  let payload;
  try {
    payload = jwt.verify(token, getSecret());
  } catch {
    throw contextError("The table QR context is invalid or has expired");
  }

  if (
    payload?.type !== CONTEXT_TYPE ||
    ![payload.tableId, payload.restaurantId, payload.outletId].every(mongoose.isValidObjectId)
  ) {
    throw contextError("The table QR context is invalid");
  }

  const [table, outlet, restaurant] = await Promise.all([
    Table.findOne({ _id: payload.tableId, restaurant: payload.restaurantId, outlet: payload.outletId }).lean(),
    Outlet.findOne({ _id: payload.outletId, restaurant: payload.restaurantId, isActive: true }).lean(),
    Restaurant.findOne({ _id: payload.restaurantId, isActive: true }).lean(),
  ]);

  if (!table || !outlet || !restaurant) {
    throw contextError("This table QR context is no longer active");
  }

  return { table, outlet, restaurant };
};

export const getPublicMenuContextToken = (req) => req.params.qrToken || req.query.qrToken || req.body?.qrToken || "";
