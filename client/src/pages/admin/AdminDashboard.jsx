import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiAlertCircle, FiBookOpen, FiCalendar, FiClipboard, FiDollarSign, FiGrid, FiRefreshCw, FiShoppingBag, FiTrendingUp } from "react-icons/fi";
import toast from "react-hot-toast";
import StatCard from "../../components/admin/StatCard";
import RecentOrders from "../../components/admin/RecentOrders";
import RequestState from "../../components/common/RequestState";
import { deleteAdminOrder, getAdminRecentOrders, getAdminSales, getAdminStats, updateAdminOrderStatus } from "../../services/adminService";
import { useSocket } from "../../context/SocketContext";

const SalesChart = lazy(() => import("../../components/admin/SalesChart"));

const DASHBOARD_ICON_MAP = {
  totalRevenue: <FiDollarSign />,
  todayRevenue: <FiTrendingUp />,
  totalOrders: <FiShoppingBag />,
  todayOrders: <FiClipboard />,
  activeReservations: <FiCalendar />,
  availableTables: <FiGrid />,
  lowStockItems: <FiAlertCircle />,
  totalMenuItems: <FiBookOpen />,
};

const SalesChartSkeleton = () => <div className="h-56 animate-pulse rounded-2xl bg-slate-100 sm:h-64 md:h-80" aria-busy="true" />;

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
  const [chartReady, setChartReady] = useState(false);
  const initialRangeRef = useRef(range);
  const initialRangeLoad = useRef(true);
  const socket = useSocket();
  const todayLabel = useMemo(() => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date()), []);

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    setStatsError("");
    try {
      const { data } = await getAdminStats();
      setStats(data.data);
    } catch (error) {
      const message = error?.response?.data?.message || "Failed to load dashboard stats";
      setStatsError(message);
      toast.error(message);
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const loadSales = useCallback(async (selectedRange) => {
    setLoadingSales(true);
    setSalesError("");
    try {
      const { data } = await getAdminSales(selectedRange);
      setSales(data.data || []);
    } catch (error) {
      const message = error?.response?.data?.message || "Failed to load sales overview";
      setSalesError(message);
      toast.error(message);
    } finally {
      setLoadingSales(false);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    setOrdersError("");
    try {
      const { data } = await getAdminRecentOrders();
      setOrders(data.data || []);
    } catch (error) {
      const message = error?.response?.data?.message || "Failed to load recent orders";
      setOrdersError(message);
      toast.error(message);
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  useEffect(() => {
    Promise.all([loadStats(), loadSales(initialRangeRef.current), loadOrders()]);
  }, [loadOrders, loadSales, loadStats]);

  useEffect(() => { setChartReady(true); }, []);

  useEffect(() => {
    if (initialRangeLoad.current) {
      initialRangeLoad.current = false;
      return;
    }
    loadSales(range);
  }, [loadSales, range]);

  useEffect(() => {
    if (!socket) return undefined;
    let refreshTimer = null;
    const refreshOrders = () => {
      if (refreshTimer) return;
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        loadOrders();
      }, 200);
    };
    socket.on("order:new", refreshOrders);
    socket.on("order:status", refreshOrders);
    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      socket.off("order:new", refreshOrders);
      socket.off("order:status", refreshOrders);
    };
  }, [loadOrders, socket]);

  const cards = useMemo(() => !stats ? [] : Object.entries(stats).map(([key, value]) => ({ key, ...value })), [stats]);

  // These existing dashboard actions remain available to the component data flow.
  const onStatusChange = useCallback(async (orderId, status) => {
    try {
      await updateAdminOrderStatus(orderId, status);
      toast.success("Order status updated");
      loadOrders();
      loadStats();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to update order status");
    }
  }, [loadOrders, loadStats]);

  const onDeleteOrder = useCallback(async (order) => {
    const confirmed = window.confirm(`Archive order ${order.orderNumber}?`);
    if (!confirmed) return;
    try {
      await deleteAdminOrder(order._id || order.orderNumber);
      setOrders((currentOrders) => currentOrders.filter((item) => item._id !== order._id));
      toast.success("Order archived");
      await Promise.all([loadOrders(), loadStats()]);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to delete order");
    }
  }, [loadOrders, loadStats]);

  const refreshDashboard = useCallback(() => {
    Promise.all([loadStats(), loadSales(range), loadOrders()]);
  }, [loadOrders, loadSales, loadStats, range]);

  return (
    <div className="space-y-5 pb-20 sm:space-y-6">
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Dashboard</h2>
          <p className="mt-1 text-sm text-slate-500">Overview of today&apos;s restaurant activity.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-xs text-slate-500 sm:inline">{todayLabel}</span>
          <button type="button" onClick={refreshDashboard} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50" aria-label="Refresh dashboard">
            <FiRefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh
          </button>
        </div>
        <span className="flex w-full items-center gap-2 text-xs text-slate-500 sm:hidden"><FiCalendar className="h-4 w-4" aria-hidden="true" />{todayLabel}</span>
      </header>

      {loadingStats ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4" aria-busy="true">
          {Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-100 sm:h-32" />)}
        </div>
      ) : statsError ? <RequestState message={statsError} onRetry={loadStats} /> : (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4" aria-label="Restaurant metrics">
          {cards.map((card) => <StatCard key={card.key} {...card} icon={DASHBOARD_ICON_MAP[card.key]} range="today" comparisonType="dashboard" compact />)}
        </section>
      )}

      <div className="grid min-w-0 gap-4 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          {chartReady ? <Suspense fallback={<SalesChartSkeleton />}><SalesChart data={sales} range={range} onRangeChange={setRange} loading={loadingSales} error={salesError} onRetry={() => loadSales(range)} /></Suspense> : <SalesChartSkeleton />}
        </div>
        <div className="min-w-0"><RecentOrders orders={orders} loading={loadingOrders} error={ordersError} onRetry={loadOrders} onStatusChange={onStatusChange} onDelete={onDeleteOrder} /></div>
      </div>
    </div>
  );
};

export default AdminDashboard;
