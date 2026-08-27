import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import SocketEvent from "../models/SocketEvent.js";
import mongoose from "mongoose";
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
      const header = socket.handshake.headers.authorization || "";
      const token = socket.handshake.auth?.token || (header.startsWith("Bearer ") ? header.slice(7) : "");
      if (!token) return next(new Error("Unauthorized socket"));

      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
      const user = await User.findById(decoded.id).select("_id role restaurant hotelId isActive").lean();
      if (!user?.isActive) return next(new Error("Unauthorized socket"));

      socket.data.user = user;
      return next();
    } catch (_error) {
      return next(new Error("Unauthorized socket"));
    }
  });

  io.on("connection", (socket) => {
    const { user } = socket.data;
    socket.join(`user:${user._id}`);
    if (user.restaurant) socket.join(`restaurant:${user.restaurant}`);
    if (user.hotelId) socket.join(`hotel:${user.hotelId}`);
    if (user.role === "super_admin") socket.join("super-admin");

    socket.on("sync", async ({ since } = {}, callback = () => {}) => {
      try {
        const sinceDate = since ? new Date(since) : new Date(Date.now() - 5 * 60 * 1000);
        if (Number.isNaN(sinceDate.getTime())) return callback({ ok: false, error: "Invalid sync timestamp" });
        const events = user.restaurant && mongoose.isValidObjectId(user.restaurant)
          ? await SocketEvent.find({ restaurant: user.restaurant, occurredAt: { $gt: sinceDate } }).sort({ occurredAt: 1, _id: 1 }).limit(500).lean()
          : [];
        callback({ ok: true, events });
      } catch (_error) {
        callback({ ok: false, error: "Sync unavailable" });
      }
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
