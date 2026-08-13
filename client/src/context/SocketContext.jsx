import { createContext, useContext, useEffect } from "react";
import { socket } from "../services/socket";

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  useEffect(() => {
    socket.connect();
    socket.emit("join-room", "dashboard");
    return () => socket.disconnect();
  }, []);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
};

export const useSocket = () => useContext(SocketContext);
