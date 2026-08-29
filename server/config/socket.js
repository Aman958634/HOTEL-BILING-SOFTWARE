import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Outlet from "../models/Outlet.js";
import { getAllowedOrigins, isOriginAllowed } from "../utils/allowedOrigins.js";

let io;

export const initSocketServer = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (isOriginAllowed(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error("Socket.IO CORS not allowed"));
      },
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Unauthorized"));
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      const user = await User.findById(decoded.id).select("_id role restaurant outletAccess isActive").lean();
      if (!user?.isActive) return next(new Error("Unauthorized"));
      const requestedOutletId = socket.handshake.auth?.outletId;
      let outlet = null;
      if (requestedOutletId) {
        const elevated = ["admin", "restaurant_admin", "hotel_admin", "super_admin"].includes(user.role);
        const assigned = (user.outletAccess || []).some((entry) => entry.isActive !== false && String(entry.outlet) === String(requestedOutletId));
        if (!elevated && !assigned) return next(new Error("Forbidden outlet"));
        outlet = await Outlet.findOne({ _id: requestedOutletId, restaurant: user.restaurant, isActive: true }).select("_id").lean();
        if (!outlet) return next(new Error("Forbidden outlet"));
      }
      socket.user = { _id: user._id, role: user.role, restaurant: user.restaurant || null, outlet: outlet?._id || null };
      return next();
    } catch (_error) { return next(new Error("Unauthorized")); }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.user._id}`);
    // Legacy dashboard events remain scoped to the authenticated restaurant.
    if (socket.user.restaurant) socket.join(`restaurant:${socket.user.restaurant}`);
    if (socket.user.outlet) socket.join(`outlet:${socket.user.outlet}`);

    socket.on("join-room", () => {
      // Client-selected rooms are intentionally ignored. Room membership is server-derived.
    });

    socket.on("order-status:update", (payload) => {
      if (socket.user.restaurant) io.to(`restaurant:${socket.user.restaurant}`).emit("order-status:changed", payload);
    });

    socket.on("disconnect", () => {});
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO is not initialized");
  }
  return io;
};

export { getAllowedOrigins };
