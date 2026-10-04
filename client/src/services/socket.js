import { io } from "socket.io-client";
import { SOCKET_URL } from "../utils/constants";
import { getAccessToken } from "../utils/authSession";

export const socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ["websocket", "polling"],
  withCredentials: true,
  auth: (callback) => callback({ token: getAccessToken(), outletId: localStorage.getItem("selectedOutletId") || "" }),
});
