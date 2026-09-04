import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FiAlertCircle, FiArrowRight, FiBookOpen, FiCalendar, FiCheckCircle, FiClipboard, FiDollarSign, FiGrid, FiHome, FiMapPin, FiRefreshCw, FiShoppingBag, FiTrendingDown, FiTrendingUp, FiUsers } from "react-icons/fi";
import toast from "react-hot-toast";
import StatCard from "../../components/admin/StatCard";
import RecentOrders from "../../components/admin/RecentOrders";
import RequestState from "../../components/common/RequestState";
import { deleteAdminOrder, getAdminRecentOrders, getAdminSales, getAdminStats, updateAdminOrderStatus } from "../../services/adminService";
import { useSocket } from "../../context/SocketContext";
import { getMyOutlets } from "../../services/outletService";
import { getRestaurantSettings } from "../../services/restaurantService";

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

const SalesChartSkeleton = () => <div className="h-48 animate-pulse rounded-xl bg-slate-100 sm:h-64 md:h-80" aria-busy="true" />;

const TrendLine = ({ label, card }) => {
  const trend = card?.trend || {};
  const isPositive = trend.type === "positive";
  const isNegative = trend.type === "negative";
  const trendLabel = trend.label === "New" ? "New activity" : trend.label === "—" || !trend.label ? "No comparison" : `${isPositive ? "+" : isNegative ? "−" : ""}${trend.label} vs yesterday`;
  return <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
    <span className="min-w-0 truncate text-sm font-medium text-slate-700">{label}</span>
    <span className={`inline-flex shrink-0 items-center gap-1 text-xs font-semibold ${isPositive ? "text-emerald-700" : isNegative ? "text-rose-700" : "text-slate-500"}`}>
      {isPositive ? <FiTrendingUp aria-hidden="true" /> : isNegative ? <FiTrendingDown aria-hidden="true" /> : null}{trendLabel}
    </span>
  </div>;
};

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
  const [setup, setSetup] = useState({ loading: true, error: false, restaurant: null, outlets: [] });
  const initialRangeRef = useRef(range);
  const initialRangeLoad = useRef(true);
  const requestControllers = useRef({ stats: null, sales: null, orders: null });
  const socket = useSocket();
  const todayLabel = useMemo(() => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date()), []);

  const loadStats = useCallback(async () => {
    requestControllers.current.stats?.abort();
    const controller = new AbortController();
    requestControllers.current.stats = controller;
    const requestedOutlet = localStorage.getItem("selectedOutletId") || "none";
    setLoadingStats(true);
    setStatsError("");
    try {
      const { data } = await getAdminStats({ signal: controller.signal });
      if (controller.signal.aborted || requestedOutlet !== (localStorage.getItem("selectedOutletId") || "none")) return;
      setStats(data.data);
    } catch (error) {
      if (controller.signal.aborted || error?.code === "ERR_CANCELED") return;
      const message = error?.response?.data?.message || "Failed to load dashboard stats";
      setStatsError(message);
      toast.error(message);
    } finally {
      if (requestControllers.current.stats === controller) setLoadingStats(false);
    }
  }, []);

  const loadSales = useCallback(async (selectedRange) => {
    requestControllers.current.sales?.abort();
    const controller = new AbortController();
    requestControllers.current.sales = controller;
    const requestedOutlet = localStorage.getItem("selectedOutletId") || "none";
    setLoadingSales(true);
    setSalesError("");
    try {
      const { data } = await getAdminSales(selectedRange, { signal: controller.signal });
      if (controller.signal.aborted || requestedOutlet !== (localStorage.getItem("selectedOutletId") || "none")) return;
      setSales(data.data || []);
    } catch (error) {
      if (controller.signal.aborted || error?.code === "ERR_CANCELED") return;
      const message = error?.response?.data?.message || "Failed to load sales overview";
      setSalesError(message);
      toast.error(message);
    } finally {
      if (requestControllers.current.sales === controller) setLoadingSales(false);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    requestControllers.current.orders?.abort();
    const controller = new AbortController();
    requestControllers.current.orders = controller;
    const requestedOutlet = localStorage.getItem("selectedOutletId") || "none";
    setLoadingOrders(true);
    setOrdersError("");
    try {
      const { data } = await getAdminRecentOrders({ signal: controller.signal });
      if (controller.signal.aborted || requestedOutlet !== (localStorage.getItem("selectedOutletId") || "none")) return;
      setOrders(data.data || []);
    } catch (error) {
      if (controller.signal.aborted || error?.code === "ERR_CANCELED") return;
      const message = error?.response?.data?.message || "Failed to load recent orders";
      setOrdersError(message);
      toast.error(message);
    } finally {
      if (requestControllers.current.orders === controller) setLoadingOrders(false);
    }
  }, []);

  useEffect(() => () => Object.values(requestControllers.current).forEach((controller) => controller?.abort()), []);

  useEffect(() => {
    Promise.all([loadStats(), loadSales(initialRangeRef.current), loadOrders()]);
  }, [loadOrders, loadSales, loadStats]);

  useEffect(() => {
    let active = true;
    Promise.all([getRestaurantSettings(), getMyOutlets()])
      .then(([restaurantResponse, outletResponse]) => {
        if (!active) return;
        setSetup({ loading: false, error: false, restaurant: restaurantResponse.data?.data || null, outlets: outletResponse.data?.data || [] });
      })
      .catch(() => {
        if (active) setSetup((current) => ({ ...current, loading: false, error: true }));
      });
    return () => { active = false; };
  }, []);

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
  const signals = useMemo(() => {
    if (!stats) return [];
    const nextSignals = [];
    const lowStock = Number(stats.lowStockItems?.value || 0);
    const availableTables = Number(stats.availableTables?.value || 0);
    if (lowStock > 0) nextSignals.push({ key: "stock", tone: "amber", text: `${lowStock} item${lowStock === 1 ? "" : "s"} at or below reorder level`, to: "/dashboard/admin/inventory", action: "Review stock" });
    if (availableTables === 0) nextSignals.push({ key: "tables", tone: "rose", text: "No tables are currently available", to: "/dashboard/admin/tables", action: "View tables" });
    return nextSignals;
  }, [stats]);

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

  const setupSteps = useMemo(() => {
    const restaurant = setup.restaurant || {};
    const hasRestaurant = Boolean(restaurant.name && restaurant.address);
    const hasOutlet = setup.outlets.some((outlet) => outlet.isActive !== false);
    const menuCount = Number(stats?.totalMenuItems?.value ?? stats?.foods?.value ?? stats?.cards?.foods ?? 0);
    const orderCount = Number(stats?.totalOrders?.value ?? stats?.orders?.value ?? stats?.cards?.orders ?? 0);
    const tableCount = Number(stats?.totalTables?.value ?? stats?.tables?.value ?? 0);
    return [
      { key: "restaurant", label: "Restaurant details", description: "Add your name and address.", complete: hasRestaurant, to: "/dashboard/admin/settings", action: "Open settings", icon: <FiHome aria-hidden="true" /> },
      { key: "outlet", label: "Outlet", description: "Confirm an active outlet for this workspace.", complete: hasOutlet, to: "/dashboard/admin/outlets", action: "Manage outlets", icon: <FiMapPin aria-hidden="true" /> },
      { key: "menu", label: "Menu", description: "Add at least one available item.", complete: menuCount > 0, to: "/dashboard/admin/menu", action: "Add menu item", icon: <FiBookOpen aria-hidden="true" /> },
      { key: "tables", label: "Tables", description: "Create a table for dine-in orders.", complete: tableCount > 0, to: "/dashboard/admin/tables", action: "Add table", icon: <FiGrid aria-hidden="true" /> },
      { key: "staff", label: "Staff", description: "Invite your operating team when ready.", complete: false, to: "/dashboard/admin/staff", action: "Add staff", icon: <FiUsers aria-hidden="true" />, optional: true },
      { key: "order", label: "First order", description: "Everything is ready to start service.", complete: orderCount > 0, to: "/dashboard/admin/orders", action: "Create order", icon: <FiShoppingBag aria-hidden="true" /> },
    ];
  }, [setup, stats]);

  const visibleSetupSteps = setupSteps.filter((step) => !step.complete && !step.optional);

  return (
    <div className="space-y-5 pb-20 sm:space-y-6">
      <header className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Dashboard</h2>
          <p className="mt-1 text-sm text-slate-500">Today’s performance, changes, and operational follow-up.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden text-xs text-slate-500 sm:inline">{todayLabel}</span>
          <button type="button" onClick={refreshDashboard} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50" aria-label="Refresh dashboard">
            <FiRefreshCw className="h-4 w-4" aria-hidden="true" /> Refresh
          </button>
        </div>
        <span className="flex w-full items-center gap-2 text-xs text-slate-500 sm:hidden"><FiCalendar className="h-4 w-4" aria-hidden="true" />{todayLabel}</span>
      </header>
      {setup.loading ? <section className="h-32 animate-pulse rounded-2xl bg-slate-100" aria-busy="true" aria-label="Loading setup progress" /> : null}
      {!setup.loading && !setup.error && visibleSetupSteps.length ? (
        <section className="ops-card border-emerald-100 bg-emerald-50/40 p-4 sm:p-5" aria-labelledby="setup-progress-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">First service setup</p><h3 id="setup-progress-title" className="mt-1 text-lg font-bold text-slate-900">Get ready to take your first order</h3><p className="mt-1 text-sm text-slate-600">Complete the essentials below. Optional features can wait until after service starts.</p></div>
            <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-800 shadow-sm">{setupSteps.length - visibleSetupSteps.length} of {setupSteps.length} ready</span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {setupSteps.map((step) => <div key={step.key} className={`flex min-w-0 items-center gap-3 rounded-xl border bg-white p-3 ${step.complete ? "border-emerald-100" : "border-slate-200"}`}><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${step.complete ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{step.complete ? <FiCheckCircle aria-hidden="true" /> : step.icon}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{step.label}</p>{step.complete ? <p className="text-xs text-emerald-700">Ready</p> : <p className="truncate text-xs text-slate-500">{step.description}</p>}</div>{!step.complete ? <Link to={step.to} className="shrink-0 text-xs font-semibold text-emerald-700 hover:text-emerald-800">{step.action}<span className="sr-only"> for {step.label}</span></Link> : null}</div>)}
          </div>
        </section>
      ) : null}

      {loadingStats ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4" aria-busy="true">
          {Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-100 sm:h-32" />)}
        </div>
      ) : statsError && !stats ? <RequestState message={statsError} onRetry={loadStats} /> : (
        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4" aria-label="Restaurant metrics">
          {cards.map((card) => <StatCard key={card.key} {...card} icon={DASHBOARD_ICON_MAP[card.key]} range="today" comparisonType="dashboard" compact />)}
        </section>
      )}

      {!loadingStats && (!statsError || stats) ? <div className="grid min-w-0 gap-4 xl:grid-cols-3">
        <section className="ops-card min-w-0 p-3 sm:p-4 xl:col-span-2" aria-labelledby="dashboard-changed-title">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><h3 id="dashboard-changed-title" className="text-base font-bold text-slate-900">What changed today</h3><p className="mt-0.5 text-xs text-slate-500">Compared with yesterday</p></div>
            <Link to="/dashboard/admin/reports" className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800">Open reports <FiArrowRight aria-hidden="true" /></Link>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <TrendLine label="Sales" card={stats?.todayRevenue} />
            <TrendLine label="Paid orders" card={stats?.todayOrders} />
          </div>
        </section>
        <section className="ops-card min-w-0 p-3 sm:p-4" aria-labelledby="dashboard-attention-title">
          <div className="flex items-center justify-between gap-2"><div><h3 id="dashboard-attention-title" className="text-base font-bold text-slate-900">Attention</h3><p className="mt-0.5 text-xs text-slate-500">Live operational signals</p></div><FiAlertCircle className={signals.length ? "text-amber-500" : "text-emerald-600"} aria-hidden="true" /></div>
          <div className="mt-3 space-y-2">
            {signals.length ? signals.map((signal) => <div key={signal.key} className={`rounded-xl border px-3 py-2.5 ${signal.tone === "rose" ? "border-rose-200 bg-rose-50" : "border-amber-200 bg-amber-50"}`}><p className={`text-sm font-medium ${signal.tone === "rose" ? "text-rose-800" : "text-amber-800"}`}>{signal.text}</p><Link to={signal.to} className={`mt-1 inline-flex items-center gap-1 text-xs font-semibold ${signal.tone === "rose" ? "text-rose-700" : "text-amber-700"}`}>{signal.action} <FiArrowRight aria-hidden="true" /></Link></div>) : <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-800"><FiCheckCircle aria-hidden="true" />No dashboard alerts right now.</div>}
          </div>
        </section>
      </div> : null}

      <div className="grid min-w-0 gap-4 xl:grid-cols-3">
        <div className="min-w-0 xl:col-span-2">
          {chartReady ? <Suspense fallback={<SalesChartSkeleton />}><SalesChart data={sales} range={range} onRangeChange={setRange} loading={loadingSales} error={salesError && !sales.length} onRetry={() => loadSales(range)} /></Suspense> : <SalesChartSkeleton />}
        </div>
        <div className="min-w-0"><RecentOrders orders={orders} loading={loadingOrders} error={ordersError && !orders.length} onRetry={loadOrders} onStatusChange={onStatusChange} onDelete={onDeleteOrder} /></div>
      </div>
    </div>
  );
};

export default AdminDashboard;
