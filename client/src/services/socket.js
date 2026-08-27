import { io } from "socket.io-client";
import { SOCKET_URL } from "../utils/constants";

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ["websocket", "polling"],
  withCredentials: true,
  auth: (callback) => callback({ token: localStorage.getItem("accessToken") || "" }),
});
