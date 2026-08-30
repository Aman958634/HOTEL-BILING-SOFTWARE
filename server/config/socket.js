import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Outlet from "../models/Outlet.js";
import { getAllowedOrigins, isOriginAllowed } from "../utils/allowedOrigins.js";
import { hasAllOutletsAccess } from "../utils/tenantUtils.js";

let io;

export const resolveSocketContext = async (handshake = {}) => {
  const token = handshake.auth?.token;
  if (!token) throw new Error("Unauthorized");

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    const user = await User.findById(decoded.id).select("_id role restaurant outletAccess allOutletsAccess isActive").lean();
    if (!user?.isActive) throw new Error("Unauthorized");

    const requestedOutletId = handshake.auth?.outletId;
    let outlet = null;
    if (requestedOutletId) {
      const assigned = (user.outletAccess || []).some((entry) => entry.isActive !== false && String(entry.outlet) === String(requestedOutletId));
      if (!hasAllOutletsAccess(user) && !assigned) throw new Error("Forbidden outlet");
      outlet = await Outlet.findOne({ _id: requestedOutletId, restaurant: user.restaurant, isActive: true }).select("_id").lean();
      if (!outlet) throw new Error("Forbidden outlet");
    }

    return { _id: user._id, role: user.role, restaurant: user.restaurant || null, outlet: outlet?._id || null };
  } catch (error) {
    if (error?.message === "Forbidden outlet") throw error;
    throw new Error("Unauthorized");
  }
};

export const getAuthorizedSocketRooms = (user) => [
  `user:${user._id}`,
  ...(user.restaurant ? [`restaurant:${user.restaurant}`] : []),
  ...(user.outlet ? [`outlet:${user.outlet}`] : []),
];

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
      socket.user = await resolveSocketContext(socket.handshake);
      return next();
    } catch (error) { return next(new Error(error?.message === "Forbidden outlet" ? "Forbidden outlet" : "Unauthorized")); }
  });

  io.on("connection", (socket) => {
    getAuthorizedSocketRooms(socket.user).forEach((room) => socket.join(room));

    socket.on("join-room", () => {
      // Client-selected rooms are intentionally ignored. Room membership is server-derived.
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
