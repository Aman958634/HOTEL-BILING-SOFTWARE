import { createContext, useContext, useEffect } from "react";
import { useSelector } from "react-redux";
import { socket } from "../services/socket";
import { SOCKET_URL } from "../utils/constants";

const SocketContext = createContext(null);

const shouldConnectSocket = () => {
  if (!SOCKET_URL) return false;
  const onLocalHost =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const pointsToLocalhost =
    SOCKET_URL.includes("localhost") || SOCKET_URL.includes("127.0.0.1");
  return onLocalHost || !pointsToLocalhost;
};

export const SocketProvider = ({ children }) => {
  const { accessToken, user, outletStatus } = useSelector((state) => state.auth);
  useEffect(() => {
    const needsOutlet = Boolean(user?.restaurant) && !["customer", "super_admin"].includes(String(user?.role || "").toLowerCase());
    if (!shouldConnectSocket() || !accessToken || !user || (needsOutlet && outletStatus !== "ready")) return undefined;

    socket.connect();
    socket.emit("join-room", "dashboard");
    const reconnectForOutlet = () => { socket.disconnect(); socket.connect(); };
    window.addEventListener("restosphere:outlet-changed", reconnectForOutlet);
    return () => { window.removeEventListener("restosphere:outlet-changed", reconnectForOutlet); socket.disconnect(); };
  }, [accessToken, outletStatus, user]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
};

export const useSocket = () => useContext(SocketContext);
