import { useEffect, useState } from "react";
import { useSocket } from "../../context/SocketContext";

const WaiterDashboard = () => {
  const [updates, setUpdates] = useState([]);
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    const onTableStatusChanged = (payload) => {
      setUpdates((prev) => [payload, ...prev].slice(0, 8));
    };

    socket.on("table:statusChanged", onTableStatusChanged);

    return () => {
      socket.off("table:statusChanged", onTableStatusChanged);
    };
  }, [socket]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Waiter Dashboard</h2>
        <p className="mt-2 text-slate-300">Manage assigned tables, take orders, and generate bills.</p>
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-900/40 p-4 text-slate-100">
        <h3 className="text-sm font-semibold">Live Table Status Feed</h3>
        {!updates.length ? (
          <p className="mt-2 text-xs text-slate-300">Waiting for live table updates...</p>
        ) : (
          <ul className="mt-2 space-y-2 text-xs">
            {updates.map((item, index) => (
              <li key={`${item.tableId}-${index}`} className="rounded-lg bg-slate-800/70 px-3 py-2">
                Table {item.tableNumber}: {item.status}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default WaiterDashboard;
