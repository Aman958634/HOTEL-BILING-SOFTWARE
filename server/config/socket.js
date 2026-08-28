import { Server } from "socket.io";
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

  io.on("connection", (socket) => {
    socket.on("join-room", (room) => socket.join(room));

    socket.on("order-status:update", (payload) => {
      io.to("dashboard").emit("order-status:changed", payload);
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
