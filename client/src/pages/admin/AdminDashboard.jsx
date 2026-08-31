import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiAlertCircle, FiBookOpen, FiCalendar, FiClipboard, FiDollarSign, FiGrid, FiShoppingBag, FiTrendingUp } from "react-icons/fi";
import toast from "react-hot-toast";
import StatCard from "../../components/admin/StatCard";
import SalesChart from "../../components/admin/SalesChart";
import RecentOrders from "../../components/admin/RecentOrders";
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
  const initialRangeRef = useRef(range);
  const initialRangeLoad = useRef(true);

  const socket = useSocket();
  const todayLabel = useMemo(
    () => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date()),
    []
  );

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const { data } = await getAdminStats();
      setStats(data.data);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load dashboard stats");
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const loadSales = useCallback(async (selectedRange) => {
    setLoadingSales(true);
    try {
      const { data } = await getAdminSales(selectedRange);
      setSales(data.data || []);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load sales overview");
    } finally {
      setLoadingSales(false);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const { data } = await getAdminRecentOrders();
      setOrders(data.data || []);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load recent orders");
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  useEffect(() => {
    Promise.all([loadStats(), loadSales(initialRangeRef.current), loadOrders()]);
  }, [loadOrders, loadSales, loadStats]);

  useEffect(() => {
    if (initialRangeLoad.current) {
      initialRangeLoad.current = false;
      return;
    }
    loadSales(range);
  }, [loadSales, range]);

  useEffect(() => {
    if (!socket) return;

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

  return (
    <div className="space-y-4 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Welcome back, Admin! 👋</h2>
          <p className="mt-1 text-sm text-slate-500">Here's what's happening with your restaurant today.</p>
        </div>
        <button className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
          <FiCalendar className="h-4 w-4" />
          <span className="hidden sm:inline">Today</span>
          <span className="sm:hidden">{todayLabel}</span>
        </button>
      </div>

      {loadingStats ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
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
          <SalesChart data={sales} range={range} onRangeChange={setRange} loading={loadingSales} />
        </div>
        <div>
          <RecentOrders orders={orders} loading={loadingOrders} onStatusChange={onStatusChange} onDelete={onDeleteOrder} />
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
