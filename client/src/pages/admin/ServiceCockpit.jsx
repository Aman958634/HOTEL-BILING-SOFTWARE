import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { FiAlertTriangle, FiCheckCircle, FiClock, FiCoffee, FiCreditCard, FiGrid, FiLoader, FiRefreshCw, FiSearch, FiShoppingBag, FiTable, FiXCircle, FiWifi, FiWifiOff } from "react-icons/fi";
import { useSocket } from "../../context/SocketContext";
import { getCockpitOverview } from "../../services/cockpitService";
import { getTables } from "../../services/tableService";
import TableStatusBadge from "../../components/admin/tables/TableStatusBadge";
import OrderStatusBadge from "../../components/admin/orders/OrderStatusBadge";
import TableDetails from "../../components/admin/tables/TableDetails";
import OrderDetailsDrawer from "../../components/admin/orders/OrderDetailsDrawer";
import { currency } from "../../utils/format";

const BOARD_COLUMNS = [
  { key: "NEW", label: "New", statuses: ["PENDING", "CONFIRMED"] },
  { key: "PREPARING", label: "Preparing", statuses: ["PREPARING"] },
  { key: "READY", label: "Ready", statuses: ["READY"] },
  { key: "SERVED", label: "Served", statuses: ["SERVED"] },
  { key: "COMPLETED", label: "Completed", statuses: ["COMPLETED"] },
];

const KITCHEN_STATUSES = ["PENDING", "CONFIRMED", "PREPARING", "READY"];

const DEFAULT_THRESHOLDS = { warning: 15, delayed: 30, critical: 45 };

const fmtDuration = (mins) => {
  const m = Math.max(0, Math.round(mins));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

const relativeTime = (value) => {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const waitSeverity = (mins, t = DEFAULT_THRESHOLDS) => {
  if (mins >= t.critical) return "critical";
  if (mins >= t.delayed) return "delayed";
  if (mins >= t.warning) return "warning";
  return "normal";
};

const severityClass = {
  normal: "text-emerald-600",
  warning: "text-amber-600",
  delayed: "text-orange-600",
  critical: "text-rose-600",
};

const Kpi = ({ label, value, sub, icon, tone = "slate" }) => {
  const tones = {
    slate: "text-slate-900",
    emerald: "text-emerald-600",
    rose: "text-rose-600",
    amber: "text-amber-600",
    violet: "text-violet-600",
    indigo: "text-indigo-600",
    sky: "text-sky-600",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <span className={tones[tone]}>{icon}</span>
      </div>
      <p className={`mt-2 text-2xl font-bold ${tones[tone]}`}>{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
};

const ServiceCockpit = () => {
  const user = useSelector((s) => s.auth?.user);
  const role = String(user?.role || "").toLowerCase();
  const socket = useSocket();

  const [overview, setOverview] = useState(null);
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [connected, setConnected] = useState(false);

  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selectedTable, setSelectedTable] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const thresholds = useMemo(
    () => overview?.config?.delayThresholds || DEFAULT_THRESHOLDS,
    [overview]
  );

  const hasAuthToken = () => Boolean(localStorage.getItem("accessToken"));

  // Guards to prevent overlapping polling requests and honour 429 backoff.
  const inFlightRef = useRef(false);
  const abortRef = useRef(null);
  const backoffUntilRef = useRef(0);
  const POLL_INTERVAL = 20000;

  const loadOverview = useCallback(async (signal) => {
    const { data } = await getCockpitOverview({}, signal ? { signal } : {});
    return data.data;
  }, []);

  const loadTables = useCallback(async (signal) => {
    const { data } = await getTables({ limit: 200 }, signal ? { signal } : {});
    return data.data || [];
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
      const [overviewData, tableData] = await Promise.all([
        loadOverview(controller.signal),
        loadTables(controller.signal),
      ]);
      setOverview(overviewData);
      setTables(tableData);
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
        setError(err?.response?.data?.message || "Unable to load live service data");
      }
    } finally {
      inFlightRef.current = false;
      abortRef.current = null;
      setLoading(false);
    }
  }, [loadOverview, loadTables]);

  // One interval for the whole screen lifetime. Cleaned up on unmount.
  useEffect(() => {
    refreshAll();
    const id = setInterval(refreshAll, POLL_INTERVAL);
    return () => {
      clearInterval(id);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [refreshAll, POLL_INTERVAL]);

  // Real-time updates via existing Socket.IO events (throttled)
  const lastFetchRef = useRef(0);
  useEffect(() => {
    if (!socket) return undefined;
    setConnected(Boolean(socket.connected));
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onEvent = () => {
      const now = Date.now();
      if (now - lastFetchRef.current < 1200) return;
      lastFetchRef.current = now;
      refreshAll();
    };
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    ["order:created", "order:statusChanged", "order:cancelled", "table:statusChanged", "payment:updated", "payment:created"].forEach((e) =>
      socket.on(e, onEvent)
    );
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      ["order:created", "order:statusChanged", "order:cancelled", "table:statusChanged", "payment:updated", "payment:created"].forEach((e) =>
        socket.off(e, onEvent)
      );
    };
  }, [socket, refreshAll]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const now = Date.now();
  const waitMinutes = (o) => Math.max(0, Math.round((now - new Date(o.createdAt).getTime()) / 60000));

  // Aggregate table -> active orders (single source: overview.orders.items)
  const tableOrderMap = useMemo(() => {
    const map = {};
    (overview?.orders?.items || []).forEach((o) => {
      if (!o.table) return;
      const id = String(o.table._id || o.table);
      if (!map[id]) map[id] = { count: 0, total: 0, oldest: o.createdAt, orders: [] };
      map[id].count += 1;
      map[id].total += Number(o.total || 0);
      map[id].orders.push(o);
      if (new Date(o.createdAt) < new Date(map[id].oldest)) map[id].oldest = o.createdAt;
    });
    return map;
  }, [overview]);

  const matchesSearchTable = (t) =>
    !search || String(t.tableNumber || "").toLowerCase().includes(search);
  const matchesSearchOrder = (o) =>
    !search ||
    String(o.orderNumber || "").toLowerCase().includes(search) ||
    String(o.customer?.fullName || "").toLowerCase().includes(search) ||
    String(o.table?.tableNumber || "").toLowerCase().includes(search);

  const visibleTables = useMemo(() => {
    let list = tables;
    if (filter === "tables") list = list.filter((t) => ["OCCUPIED", "RESERVED"].includes(String(t.status).toUpperCase()));
    return list.filter(matchesSearchTable);
  }, [tables, filter, search]);

  const visibleOrders = useMemo(() => {
    let list = overview?.orders?.items || [];
    if (filter === "kot") list = list.filter((o) => KITCHEN_STATUSES.includes(o.status));
    else if (filter === "ready") list = list.filter((o) => o.status === "READY");
    else if (filter === "delayed") list = list.filter((o) => KITCHEN_STATUSES.includes(o.status) && waitMinutes(o) >= thresholds.delayed);
    else if (filter === "payment") list = list.filter((o) => String(o.paymentStatus || "").toUpperCase() === "PENDING");
    return list.filter(matchesSearchOrder);
  }, [overview, filter, search, thresholds, now]);

  const tablesSummary = overview?.tablesSummary;
  const ordersSummary = overview?.orders?.summary;
  const kitchen = overview?.kitchen;
  const revenue = overview?.revenue;

  const serviceStatus = tablesSummary && tablesSummary.OCCUPIED > 0 ? "BUSY" : "OPEN";

  const filterChips = [
    { key: "all", label: "All" },
    { key: "tables", label: "Tables" },
    { key: "orders", label: "Orders" },
    { key: "kot", label: "KOT" },
    { key: "ready", label: "Ready" },
    { key: "delayed", label: "Delayed" },
    { key: "payment", label: "Payment Pending" },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Live Service Cockpit</h2>
          <p className="mt-1 text-sm text-slate-500">
            {user?.restaurantName || "Restaurant"} · {new Date().toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })} ·{" "}
            {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
            serviceStatus === "BUSY" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}>
            {serviceStatus === "BUSY" ? <FiAlertTriangle /> : <FiCheckCircle />}
            {serviceStatus}
          </span>
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
            connected ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-slate-100 text-slate-600"
          }`}>
            {connected ? <FiWifi /> : <FiWifiOff />}
            {connected ? "Live" : "Offline"}
          </span>
          <button
            onClick={refreshAll}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            <FiRefreshCw className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-white">
              {String(user?.fullName || user?.email || "U").charAt(0).toUpperCase()}
            </span>
            <span className="hidden sm:block">{user?.fullName || user?.email}</span>
          </div>
        </div>
      </div>

      {/* KPI bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <Kpi label="Tables" value={tablesSummary?.total ?? "-"} sub={`${tablesSummary?.AVAILABLE ?? 0} free · ${tablesSummary?.OCCUPIED ?? 0} busy`} icon={<FiGrid />} />
        <Kpi label="Occupied" value={tablesSummary?.OCCUPIED ?? "-"} tone="rose" icon={<FiTable />} />
        <Kpi label="Active Orders" value={ordersSummary?.active ?? "-"} tone="sky" icon={<FiShoppingBag />} />
        <Kpi label="Preparing" value={ordersSummary?.byStatus?.PREPARING ?? 0} tone="violet" icon={<FiLoader />} />
        <Kpi label="Ready" value={ordersSummary?.byStatus?.READY ?? 0} tone="indigo" icon={<FiCheckCircle />} />
        <Kpi label="Delayed KOT" value={kitchen?.delayedKot ?? 0} tone={kitchen?.delayedKot ? "rose" : "slate"} icon={<FiAlertTriangle />} />
        <Kpi label="Pending KOT" value={kitchen?.newKot ?? 0} tone="amber" icon={<FiCoffee />} />
        <Kpi label="Today's Sales" value={revenue ? currency(revenue.todaySales) : "-"} tone="emerald" icon={<FiCreditCard />} />
        <Kpi label="Unpaid Bills" value={revenue?.unpaidBills ?? "-"} sub={revenue ? currency(revenue.unpaidAmount) : ""} tone="amber" icon={<FiCreditCard />} />
        <Kpi label="Payment Pending" value={revenue?.pendingPayments ?? "-"} tone="sky" icon={<FiClock />} />
        <Kpi label="Completed" value={ordersSummary?.byStatus?.COMPLETED ?? 0} tone="emerald" icon={<FiCheckCircle />} />
        <Kpi label="Served" value={ordersSummary?.byStatus?.SERVED ?? 0} tone="emerald" icon={<FiCheckCircle />} />
      </div>

      {/* Filters + search */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {filterChips.map((c) => (
            <button
              key={c.key}
              onClick={() => setFilter(c.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                filter === c.key ? "bg-brand-700 text-white" : "border border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-1.5">
          <FiSearch className="text-slate-400" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search table / order / customer"
            className="w-48 bg-transparent text-sm outline-none"
          />
        </div>
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
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Table map */}
        <section className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">Table Map</h3>
            <span className="text-xs text-slate-500">{visibleTables.length} tables</span>
          </div>
          {loading && !tables.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100" />
              ))}
            </div>
          ) : visibleTables.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">No tables match the current filter.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleTables.map((t) => {
                const agg = tableOrderMap[String(t._id)];
                const status = String(t.status || "").toUpperCase();
                return (
                  <button
                    key={t._id}
                    onClick={() => setSelectedTable(t)}
                    className={`rounded-xl border p-3 text-left transition hover:shadow-md ${
                      status === "OCCUPIED" ? "border-rose-200 bg-rose-50/40" : status === "RESERVED" ? "border-amber-200 bg-amber-50/40" : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-900">Table {t.tableNumber}</span>
                      <TableStatusBadge status={t.status} />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{t.capacity} seats · {t.floor}/{t.section}</p>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-slate-600">
                        {agg?.count ? `${agg.count} active` : "Free"}
                      </span>
                      {agg?.total ? <span className="font-semibold text-slate-900">{currency(agg.total)}</span> : null}
                    </div>
                    {agg?.oldest ? (
                      <p className="mt-1 text-[11px] text-slate-400">Occupied {relativeTime(agg.oldest)}</p>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Activity feed */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-base font-semibold text-slate-900">Live Activity</h3>
          {!overview ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : (overview.activity || []).length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">No recent activity.</p>
          ) : (
            <ul className="max-h-[420px] space-y-2 overflow-y-auto">
              {(overview.activity || []).map((a) => (
                <li key={a.id} className="flex items-start gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2 text-xs">
                  <span className={a.type === "payment" ? "text-emerald-600" : "text-sky-600"}>
                    {a.type === "payment" ? <FiCreditCard /> : <FiShoppingBag />}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-slate-700">{a.text}</p>
                    <p className="text-[11px] text-slate-400">{relativeTime(a.time)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Order board */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 text-base font-semibold text-slate-900">Order Board</h3>
        {loading && !overview ? (
          <div className="grid gap-3 md:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {BOARD_COLUMNS.map((col) => {
              const colOrders = visibleOrders.filter((o) => col.statuses.includes(o.status));
              return (
                <div key={col.key} className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <span className="text-sm font-semibold text-slate-800">{col.label}</span>
                    <span className="rounded-full bg-slate-200 px-2 text-xs font-medium text-slate-700">{colOrders.length}</span>
                  </div>
                  <div className="max-h-[460px] space-y-2 overflow-y-auto">
                    {colOrders.length === 0 ? (
                      <p className="px-1 py-6 text-center text-xs text-slate-400">None</p>
                    ) : (
                      colOrders.map((o) => {
                        const mins = waitMinutes(o);
                        const sev = waitSeverity(mins, thresholds);
                        return (
                          <button
                            key={o._id}
                            onClick={() => setSelectedOrder(o)}
                            className="w-full rounded-lg border border-slate-200 bg-white p-2 text-left transition hover:border-brand-300 hover:shadow-sm"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-slate-900">#{o.orderNumber}</span>
                              <OrderStatusBadge status={o.status} />
                            </div>
                            <p className="mt-1 text-xs text-slate-500">
                              Table {o.table?.tableNumber || "-"} · {(o.items || []).reduce((s, i) => s + (i.quantity || 1), 0)} items
                            </p>
                            <div className="mt-1 flex items-center justify-between text-[11px]">
                              <span className={`inline-flex items-center gap-1 font-medium ${severityClass[sev]}`}>
                                <FiClock /> {fmtDuration(mins)}
                              </span>
                              <span className="text-slate-400">{relativeTime(o.createdAt)}</span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Reused modals (no duplicate business logic) */}
      <TableDetails
        open={Boolean(selectedTable)}
        loading={false}
        table={selectedTable}
        onClose={() => setSelectedTable(null)}
      />
      <OrderDetailsDrawer
        open={Boolean(selectedOrder)}
        order={selectedOrder}
        loading={false}
        onClose={() => setSelectedOrder(null)}
      />
    </div>
  );
};

export default ServiceCockpit;
