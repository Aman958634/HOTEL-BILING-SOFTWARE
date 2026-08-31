import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiAlertCircle, FiBookOpen, FiCalendar, FiClipboard, FiDollarSign, FiGrid, FiRefreshCw, FiShoppingBag, FiTrendingUp } from "react-icons/fi";
import toast from "react-hot-toast";
import { useSelector } from "react-redux";
import StatCard from "../../components/admin/StatCard";
import SalesChart from "../../components/admin/SalesChart";
import RecentOrders from "../../components/admin/RecentOrders";
import EmptyState from "../../components/common/EmptyState";
import { deleteAdminOrder, getAdminRecentOrders, getAdminSales, getAdminStats, updateAdminOrderStatus } from "../../services/adminService";
import { useSocket } from "../../context/SocketContext";

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [sales, setSales] = useState([]);
  const [orders, setOrders] = useState([]);
  const [range, setRange] = useState("7d");
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingSales, setLoadingSales] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [statsError, setStatsError] = useState("");
  const [salesError, setSalesError] = useState("");
  const [ordersError, setOrdersError] = useState("");
  const { activeOutletId, outletStatus } = useSelector((state) => state.auth);
  const requestsRef = useRef({});
  const realtimeTimerRef = useRef(null);

  const socket = useSocket();

  const requestSection = useCallback((section, key, request, apply, setLoading, setError, fallbackMessage) => {
    const current = requestsRef.current[section];
    if (current?.key === key) return current.promise;
    current?.controller?.abort();

    const controller = new AbortController();
    const entry = { key, controller, promise: null };
    const promise = (async () => {
      setLoading(true);
      setError("");
      try {
        const response = await request({ signal: controller.signal });
        if (requestsRef.current[section] === entry) apply(response.data?.data);
      } catch (error) {
        if (controller.signal.aborted || error?.code === "ERR_CANCELED") return;
        if (requestsRef.current[section] === entry) {
          const message = error?.response?.data?.message || fallbackMessage;
          setError(message);
          toast.error(message);
        }
      } finally {
        if (requestsRef.current[section] === entry) {
          delete requestsRef.current[section];
          setLoading(false);
        }
      }
    })();
    entry.promise = promise;
    requestsRef.current[section] = entry;
    return promise;
  }, []);

  const loadStats = useCallback((scopeKey) => requestSection("stats", scopeKey, getAdminStats, setStats, setLoadingStats, setStatsError, "Failed to load dashboard stats"), [requestSection]);
  const loadSales = useCallback((selectedRange, scopeKey) => requestSection("sales", `${scopeKey}:${selectedRange}`, (config) => getAdminSales(selectedRange, config), (data) => setSales(data || []), setLoadingSales, setSalesError, "Failed to load sales overview"), [requestSection]);
  const loadOrders = useCallback((scopeKey) => requestSection("orders", scopeKey, getAdminRecentOrders, (data) => setOrders(data || []), setLoadingOrders, setOrdersError, "Failed to load recent orders"), [requestSection]);

  const outletReady = outletStatus === "ready";
  const scopeKey = activeOutletId || "tenant";

  // Sales owns its own effect. This covers the first ready outlet, range
  // changes, and outlet changes without overlapping the stats/orders load.
  useEffect(() => {
    if (!outletReady) return;
    loadSales(range, scopeKey);
  }, [loadSales, outletReady, range, scopeKey]);

  useEffect(() => {
    if (!outletReady) return;
    loadStats(scopeKey);
    loadOrders(scopeKey);
  }, [loadOrders, loadStats, outletReady, scopeKey]);

  useEffect(() => {
    if (!socket) return;

    const refreshDashboard = () => {
      if (realtimeTimerRef.current) return;
      realtimeTimerRef.current = window.setTimeout(() => {
        realtimeTimerRef.current = null;
        if (!outletReady) return;
        loadStats(scopeKey);
        loadSales(range, scopeKey);
        loadOrders(scopeKey);
      }, 250);
    };
    socket.on("order:new", refreshDashboard);
    socket.on("order:status", refreshDashboard);

    return () => {
      socket.off("order:new", refreshDashboard);
      socket.off("order:status", refreshDashboard);
      if (realtimeTimerRef.current) window.clearTimeout(realtimeTimerRef.current);
      realtimeTimerRef.current = null;
    };
  }, [loadOrders, loadSales, loadStats, outletReady, range, scopeKey, socket]);

  useEffect(() => () => Object.values(requestsRef.current).forEach((entry) => entry.controller?.abort()), []);

  const cards = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats).map(([key, value]) => ({
      key,
      ...value,
    }));
  }, [stats]);

  const iconMap = {
    totalRevenue: <FiDollarSign />,
    todayRevenue: <FiTrendingUp />,
    totalOrders: <FiShoppingBag />,
    todayOrders: <FiClipboard />,
    activeReservations: <FiCalendar />,
    availableTables: <FiGrid />,
    lowStockItems: <FiAlertCircle />,
    totalMenuItems: <FiBookOpen />,
  };

  const onStatusChange = async (orderId, status) => {
    try {
      await updateAdminOrderStatus(orderId, status);
      toast.success("Order status updated");
      loadOrders(scopeKey);
      loadStats(scopeKey);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to update order status");
    }
  };

  const onDeleteOrder = async (order) => {
    const confirmed = window.confirm(`Archive order ${order.orderNumber}?`);
    if (!confirmed) return;

    try {
      await deleteAdminOrder(order._id || order.orderNumber);
      setOrders((currentOrders) => currentOrders.filter((item) => item._id !== order._id));
      toast.success("Order archived");
      await Promise.all([loadOrders(scopeKey), loadStats(scopeKey)]);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to delete order");
    }
  };

  return (
    <div className="space-y-4 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Welcome back, Admin! 👋</h2>
          <p className="mt-1 text-sm text-slate-500">Here's what's happening with your restaurant today.</p>
        </div>
        <button type="button" onClick={() => setRange("today")} disabled={range === "today" || loadingSales} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
          <FiCalendar className="h-4 w-4" />
          <span className="hidden sm:inline">Today</span>
          <span className="sm:hidden">{new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date())}</span>
        </button>
      </div>

      {loadingStats ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : statsError ? (
        <EmptyState icon={<FiAlertCircle className="h-8 w-8 text-rose-500" />} title="Dashboard summary is unavailable" description={statsError} action={<button type="button" onClick={() => loadStats(scopeKey)} className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-sm font-medium text-white"><FiRefreshCw />Retry</button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <StatCard 
              key={card.key} 
              {...card} 
              icon={iconMap[card.key]}
              range="today"
              comparisonType="dashboard"
            />
          ))}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <SalesChart data={sales} range={range} onRangeChange={setRange} loading={loadingSales} error={salesError} onRetry={() => loadSales(range, scopeKey)} />
        </div>
        <div>
          <RecentOrders orders={orders} loading={loadingOrders} error={ordersError} onRetry={() => loadOrders(scopeKey)} onStatusChange={onStatusChange} onDelete={onDeleteOrder} />
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
