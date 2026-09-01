import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { FiAlertTriangle, FiCheckCircle, FiClock, FiCoffee, FiLoader, FiMaximize, FiMinimize, FiRefreshCw, FiSearch, FiVolume2, FiVolumeX, FiWifi, FiWifiOff } from "react-icons/fi";
import { useSocket } from "../../context/SocketContext";
import { getKitchenTickets, getKitchenStations, updateKitchenItemStatus, bulkStartKitchenItems, bulkReadyKitchenItems, bulkServeKitchenItems } from "../../services/kitchenService";
import KdsHeader from "../../components/kitchen/KdsHeader";
import KdsBoard from "../../components/kitchen/KdsBoard";
import EmptyState from "../../components/common/EmptyState";
import { SkeletonList } from "../../components/common/Skeletons";
import { getTicketBoardPhase } from "../../utils/kitchenDisplay";

const DEFAULT_THRESHOLDS = { warning: 15, delayed: 30, critical: 45 };

const fmtDuration = (mins) => {
  const m = Math.max(0, Math.round(mins));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

const waitSeverity = (mins, t = DEFAULT_THRESHOLDS) => {
  if (mins >= t.critical) return "critical";
  if (mins >= t.delayed) return "delayed";
  if (mins >= t.warning) return "warning";
  return "normal";
};

// `new_kot` / `kot_updated` contain KOT documents, while the board renders
// kitchen-ticket DTOs. Adapt the socket payload so a new KOT appears instantly
// before the background refresh enriches its table/customer details.
const ticketFromKotSocket = (kot) => {
  if (!kot?._id || !kot?.orderId) return null;
  const kotStatus = String(kot.status || "NEW").toUpperCase();
  const kitchenPhase = kotStatus === "SERVED" ? "COMPLETED" : kotStatus;
  return {
    kotId: kot._id,
    orderId: kot.orderId?._id || kot.orderId,
    orderNumber: kot.orderNumber,
    orderType: kot.orderType,
    status: kotStatus === "SERVED" ? "SERVED" : "PENDING",
    kitchenStatus: kitchenPhase === "COMPLETED" ? "COMPLETED" : kitchenPhase === "READY" ? "READY" : kitchenPhase === "PREPARING" ? "PREPARING" : "PENDING",
    kitchenPhase,
    kotStatus,
    createdAt: kot.createdAt || new Date().toISOString(),
    updatedAt: kot.updatedAt || new Date().toISOString(),
    table: kot.tableId || null,
    customer: null,
    restaurant: kot.restaurant || null,
    items: (kot.items || []).map((item) => ({
      index: item.orderItemIndex,
      name: item.name,
      quantity: item.quantity ?? item.qty ?? 1,
      specialInstructions: item.specialInstructions || "",
      kitchenStatus: item.status || "NEW",
      menuItem: item.menuItem || null,
    })),
  };
};

const KitchenDisplay = () => {
  const user = useSelector((s) => s.auth?.user);
  const role = String(user?.role || "").toLowerCase();
  const socket = useSocket();

  const [tickets, setTickets] = useState([]);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [connected, setConnected] = useState(false);

  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [stationFilter, setStationFilter] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundMuted, setSoundMuted] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);

  const thresholds = DEFAULT_THRESHOLDS;
  const audioRef = useRef(null);
  const socketRefreshRef = useRef(null);

  // Guards to prevent overlapping polling requests and honour 429 backoff.
  const inFlightRef = useRef(false);
  const abortRef = useRef(null);
  const backoffUntilRef = useRef(0);
  const POLL_INTERVAL = 15000;

  const canUpdate = ["admin", "manager", "chef"].includes(role);
  const canComplete = ["admin", "manager"].includes(role);

  const playAlert = useCallback(() => {
    if (soundMuted) return;
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio("data:audio/wav;base64,UklGRl9vT1BXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU");
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } catch (_) {
      // ignore audio errors
    }
  }, [soundMuted]);

  const hasAuthToken = () => Boolean(localStorage.getItem("accessToken"));

  const loadTickets = useCallback(
    async (signal) => {
      const { data } = await getKitchenTickets(
        {
          limit: 200,
          ...(stationFilter ? { station: stationFilter } : {}),
        },
        signal ? { signal } : {}
      );
      return data.data || [];
    },
    [stationFilter]
  );

  const loadStations = useCallback(async (signal) => {
    try {
      const { data } = await getKitchenStations({}, signal ? { signal } : {});
      return data.data || [];
    } catch (_) {
      // stations are optional, keep whatever we already have
      return null;
    }
  }, []);

  // Single, guarded polling request. Never overlaps with an in-flight request,
  // never runs without a token, and backs off after a 429.
  const refreshAll = useCallback(async () => {
    if (inFlightRef.current) return;
    if (Date.now() < backoffUntilRef.current) return;
    if (!hasAuthToken()) return;

    const controller = new AbortController();
    abortRef.current = controller;
    inFlightRef.current = true;
    try {
      setError(null);
      const [ticketData, stationData] = await Promise.all([
        loadTickets(controller.signal),
        loadStations(controller.signal),
      ]);
      setTickets(ticketData);
      if (stationData) setStations(stationData);
      setLastUpdated(new Date());
    } catch (err) {
      if (controller.signal.aborted) return;
      const status = err?.response?.status;
      if (status === 429) {
        const retryAfter = Number(err?.response?.headers?.["retry-after"]);
        const backoff =
          Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 30000;
        backoffUntilRef.current = Date.now() + backoff;
        setError("Too many requests. Pausing updates and retrying shortly…");
      } else {
        setError(err?.response?.data?.message || "Unable to load kitchen tickets");
      }
    } finally {
      inFlightRef.current = false;
      abortRef.current = null;
      setLoading(false);
    }
  }, [loadTickets, loadStations]);

  // One interval for the whole screen lifetime. Cleaned up on unmount.
  useEffect(() => {
    refreshAll();
    const id = setInterval(refreshAll, POLL_INTERVAL);
    return () => {
      clearInterval(id);
      if (abortRef.current) abortRef.current.abort();
      if (socketRefreshRef.current) clearTimeout(socketRefreshRef.current);
    };
  }, [refreshAll, POLL_INTERVAL]);

  useEffect(() => {
    if (!socket) return undefined;
    setConnected(Boolean(socket.connected));
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const scheduleRefresh = () => {
      if (socketRefreshRef.current) return;
      socketRefreshRef.current = setTimeout(() => {
        socketRefreshRef.current = null;
        refreshAll();
      }, 250);
    };
    const upsertKot = (payload, alert = false) => {
      const ticket = ticketFromKotSocket(payload);
      if (ticket) {
        setTickets((previous) => {
          const index = previous.findIndex((item) => String(item.orderId) === String(ticket.orderId));
          if (index < 0) return [ticket, ...previous];
          const next = [...previous];
          next[index] = { ...next[index], ...ticket };
          return next;
        });
      }
      if (alert) playAlert();
      scheduleRefresh();
    };
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    const onKotCreated = (payload) => upsertKot(payload, true);
    const onKotUpdated = (payload) => upsertKot(payload);
    const onEvent = () => scheduleRefresh();
    [
      "kitchen:ticketCreated",
      "kitchen:itemStatusChanged",
      "kitchen:orderStatusChanged",
      "order:statusChanged",
      "order:created",
      "order:cancelled",
    ].forEach((e) => socket.on(e, onEvent));
    socket.on("new_kot", onKotCreated);
    socket.on("kot_updated", onKotUpdated);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      [
        "kitchen:ticketCreated",
        "kitchen:itemStatusChanged",
        "kitchen:orderStatusChanged",
        "order:statusChanged",
        "order:created",
        "order:cancelled",
      ].forEach((e) => socket.off(e, onEvent));
      socket.off("new_kot", onKotCreated);
      socket.off("kot_updated", onKotUpdated);
      if (socketRefreshRef.current) {
        clearTimeout(socketRefreshRef.current);
        socketRefreshRef.current = null;
      }
    };
  }, [socket, refreshAll, playAlert]);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const waitMinutes = useCallback((ticket) => Math.max(0, Math.round((now - new Date(ticket.createdAt).getTime()) / 60000)), [now]);

  const visibleTickets = useMemo(() => {
    let list = tickets;
    if (stationFilter) {
      list = list.filter((t) => (t.items || []).some((i) => {
        const stationId = i.menuItem?.kitchenStation?._id || i.menuItem?.kitchenStation;
        return stationId && String(stationId) === String(stationFilter);
      }));
    }
    if (filter === "new") list = list.filter((t) => getTicketBoardPhase(t) === "NEW");
    else if (filter === "preparing") list = list.filter((t) => getTicketBoardPhase(t) === "PREPARING");
    else if (filter === "ready") list = list.filter((t) => getTicketBoardPhase(t) === "READY");
    else if (filter === "completed") list = list.filter((t) => getTicketBoardPhase(t) === "COMPLETED");
    else if (filter === "delayed") list = list.filter((t) => waitMinutes(t) >= thresholds.delayed);

    if (search) {
      list = list.filter((t) =>
        String(t.orderNumber || "").toLowerCase().includes(search) ||
        String(t.table?.tableNumber || "").toLowerCase().includes(search) ||
        (t.items || []).some((i) => String(i.name || "").toLowerCase().includes(search))
      );
    }
    return list;
  }, [tickets, filter, search, stationFilter, thresholds, waitMinutes]);

  const counts = useMemo(() => {
    const c = { new: 0, preparing: 0, ready: 0, completed: 0, delayed: 0 };
    tickets.forEach((t) => {
      const mins = waitMinutes(t);
      const phase = getTicketBoardPhase(t);
      if (phase === "NEW") c.new++;
      else if (phase === "PREPARING") c.preparing++;
      else if (phase === "READY") c.ready++;
      else if (phase === "COMPLETED") c.completed++;
      if (["NEW", "PREPARING"].includes(phase)) c.delayed += mins >= thresholds.delayed ? 1 : 0;
    });
    return c;
  }, [tickets, thresholds, waitMinutes]);

  const handleItemStatusChange = useCallback(async (orderId, itemIndex, kitchenStatus) => {
    setTickets((prev) => {
      const next = [...prev];
      const ticket = next.find((t) => String(t.orderId) === String(orderId));
      if (!ticket) return prev;
      const item = ticket.items[itemIndex];
      if (item) item.kitchenStatus = kitchenStatus;
      return next;
    });
    try {
      const { data } = await updateKitchenItemStatus(orderId, itemIndex, kitchenStatus);
      setTickets((prev) => {
        const next = [...prev];
        const idx = next.findIndex((t) => String(t.orderId) === String(orderId));
        if (idx >= 0) next[idx] = data.data;
        return next;
      });
    } catch (err) {
      const message = err?.response?.data?.message || "Unable to update kitchen item";
      setError(message);
      refreshAll();
    }
  }, [refreshAll]);

  const handleBulkStart = useCallback(async (orderId) => {
    try {
      const { data } = await bulkStartKitchenItems(orderId);
      setTickets((prev) => {
        const next = [...prev];
        const idx = next.findIndex((t) => String(t.orderId) === String(orderId));
        if (idx >= 0) next[idx] = data.data;
        return next;
      });
    } catch (err) {
      const message = err?.response?.data?.message || "Unable to start kitchen items";
      setError(message);
      refreshAll();
    }
  }, [refreshAll]);

  const handleBulkReady = useCallback(async (orderId) => {
    try {
      const { data } = await bulkReadyKitchenItems(orderId);
      setTickets((prev) => {
        const next = [...prev];
        const idx = next.findIndex((t) => String(t.orderId) === String(orderId));
        if (idx >= 0) next[idx] = data.data;
        return next;
      });
    } catch (err) {
      const message = err?.response?.data?.message || "Unable to mark items ready";
      setError(message);
      refreshAll();
    }
  }, [refreshAll]);

  const handleBulkComplete = useCallback(async (orderId) => {
    try {
      const { data } = await bulkServeKitchenItems(orderId);
      setTickets((prev) => {
        const next = [...prev];
        const idx = next.findIndex((t) => String(t.orderId) === String(orderId));
        if (idx >= 0) next[idx] = data.data;
        return next;
      });
    } catch (_) {
      refreshAll();
    }
  }, [refreshAll]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const filterChips = [
    { key: "all", label: "All" },
    { key: "new", label: "New" },
    { key: "preparing", label: "Preparing" },
    { key: "ready", label: "Ready" },
    { key: "completed", label: "Completed" },
    { key: "delayed", label: "Delayed" },
  ];

  return (
    <div className="space-y-5 overflow-x-hidden">
      <KdsHeader
        restaurantName={user?.restaurantName}
        now={new Date()}
        connected={connected}
        counts={counts}
        thresholds={thresholds}
        isFullscreen={isFullscreen}
        soundMuted={soundMuted}
        onToggleFullscreen={toggleFullscreen}
        onToggleSound={() => setSoundMuted((m) => !m)}
      />

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {filterChips.map((c) => (
            <button
              key={c.key}
              onClick={() => setFilter(c.key)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                filter === c.key ? "bg-brand-700 text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {stations.length > 0 && (
          <select
            value={stationFilter}
            onChange={(e) => setStationFilter(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700"
          >
            <option value="">All Stations</option>
            {stations.map((s) => (
              <option key={s._id} value={String(s._id)}>{s.name}</option>
            ))}
          </select>
        )}

        <div className="ml-auto flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-1.5">
          <FiSearch className="text-slate-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search order / table / item"
            className="w-48 bg-transparent text-sm outline-none"
          />
        </div>

        <button
          onClick={refreshAll}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          <FiRefreshCw className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-sm text-rose-700">
          {error}
          <div className="mt-3">
            <button onClick={refreshAll} className="rounded-lg border border-rose-300 px-3 py-1.5 text-rose-700 hover:bg-rose-100">
              Retry
            </button>
          </div>
        </div>
      ) : loading && tickets.length === 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><SkeletonList count={4} className="h-80" /></div>
      ) : visibleTickets.length === 0 ? (
        <EmptyState title="No kitchen orders yet" description="New kitchen orders will appear here." />
      ) : (
        <KdsBoard
          tickets={visibleTickets}
          thresholds={thresholds}
          canUpdate={canUpdate}
          canComplete={canComplete}
          onItemStatusChange={handleItemStatusChange}
          onBulkStart={handleBulkStart}
          onBulkReady={handleBulkReady}
          onBulkComplete={handleBulkComplete}
        />
      )}

      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={() => setSelectedTicket(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Order #{selectedTicket.orderNumber}</h3>
                <p className="text-sm text-slate-500">
                  {selectedTicket.table?.tableNumber ? `Table ${selectedTicket.table.tableNumber}` : selectedTicket.orderType} · {selectedTicket.status}
                </p>
              </div>
              <button onClick={() => setSelectedTicket(null)} className="rounded-lg border border-slate-300 px-3 py-1 text-sm">Close</button>
            </div>
            <div className="mt-4 space-y-2">
              {(selectedTicket.items || []).map((item) => (
                <div key={item.index} className="flex items-center justify-between rounded-lg border border-slate-100 p-3 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{item.quantity}× {item.name}</p>
                    {item.specialInstructions ? <p className="text-xs text-slate-500">"{item.specialInstructions}"</p> : null}
                  </div>
                  <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                    String(item.kitchenStatus || "NEW").toUpperCase() === "READY" ? "border-emerald-200 bg-emerald-50 text-emerald-700" :
                    String(item.kitchenStatus || "NEW").toUpperCase() === "PREPARING" ? "border-amber-200 bg-amber-50 text-amber-700" :
                    String(item.kitchenStatus || "NEW").toUpperCase() === "CANCELLED" ? "border-rose-200 bg-rose-50 text-rose-700" :
                    "border-slate-200 bg-slate-50 text-slate-700"
                  }`}>
                    {item.kitchenStatus || "NEW"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KitchenDisplay;
