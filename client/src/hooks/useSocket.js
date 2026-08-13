import { useSocket } from "../context/SocketContext";

const useSocketEvents = (event, callback) => {
  const socket = useSocket();
  if (!socket) return;
  socket.on(event, callback);
  return () => socket.off(event, callback);
};

export default useSocketEvents;
