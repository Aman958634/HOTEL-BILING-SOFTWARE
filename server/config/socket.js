import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
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
