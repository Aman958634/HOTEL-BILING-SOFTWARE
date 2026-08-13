import { Server } from "socket.io";

let io;

export const initSocketServer = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL,
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
