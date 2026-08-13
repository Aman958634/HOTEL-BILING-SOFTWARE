import { useEffect, useState } from "react";
import { FiBarChart2, FiDollarSign, FiHome, FiLayers, FiShoppingBag, FiUsers } from "react-icons/fi";
import toast from "react-hot-toast";
import { getSuperAdminStats } from "../../services/superAdminService";
import StatCard from "../../components/admin/StatCard";

const statMap = [
  { key: "totalRestaurants", label: "Total Restaurants/Hotels", icon: <FiLayers /> },
  { key: "activeRestaurants", label: "Active Restaurants/Hotels", icon: <FiHome /> },
  { key: "totalUsers", label: "Total Users", icon: <FiUsers /> },
  { key: "totalOrders", label: "Total Orders", icon: <FiShoppingBag /> },
  { key: "totalRevenue", label: "Total Revenue", icon: <FiDollarSign /> },
];

const SuperAdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadStats = async () => {
    setLoading(true);
    try {
      const { data } = await getSuperAdminStats();
      setStats(data.data);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load super admin stats");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-teal-500">Super Admin Dashboard</p>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">SaaS oversight and performance</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Monitor restaurants, hotels, users, orders, and revenue across the platform with a single secure view.
            </p>
          </div>
          <div className="rounded-3xl bg-slate-950 px-5 py-3 text-slate-100 shadow-sm">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Active scope</p>
            <p className="mt-2 text-xl font-semibold">Platform-wide</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {statMap.map((stat) => (
          <div key={stat.key} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div className="rounded-2xl bg-slate-100 p-3 text-teal-600">{stat.icon}</div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">{stat.label}</p>
            </div>
            <div className="mt-6">
              {loading ? (
                <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
              ) : (
                <p className="text-3xl font-semibold text-slate-900">{stat.key === "totalRevenue" ? `₹ ${stats?.[stat.key]?.toLocaleString() || 0}` : stats?.[stat.key] ?? 0}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Platform Summary</h2>
          <p className="mt-2 text-sm text-slate-500">Key metrics for restaurants, hotels, users, orders, and revenue across the full SaaS platform.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Total Restaurants</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{loading ? "—" : stats?.totalRestaurants ?? 0}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Active Restaurants</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{loading ? "—" : stats?.activeRestaurants ?? 0}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Total Hotels</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{loading ? "—" : stats?.totalHotels ?? 0}</p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">Active Hotels</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{loading ? "—" : stats?.activeHotels ?? 0}</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Quick Actions</h2>
          <div className="mt-6 grid gap-3">
            <button className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-slate-700 hover:bg-slate-100">
              View restaurant inventory and performance
            </button>
            <button className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-slate-700 hover:bg-slate-100">
              Review subscription and payment health
            </button>
            <button className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-slate-700 hover:bg-slate-100">
              Manage users and SaaS access controls
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
