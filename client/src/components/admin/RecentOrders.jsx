import { memo } from "react";
import { currency, dateTime } from "../../utils/format";
import { FiCheckCircle, FiClock, FiDollarSign, FiShoppingBag, FiUser, FiXCircle } from "react-icons/fi";

const statusOptions = [
  { label: "Pending", value: "PENDING" },
  { label: "Confirmed", value: "CONFIRMED" },
  { label: "Preparing", value: "PREPARING" },
  { label: "Ready", value: "READY" },
  { label: "Served", value: "SERVED" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
];

const statusBadgeClass = (status) => {
  const normalized = String(status || "").toUpperCase();
  switch (normalized) {
    case "COMPLETED":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "PENDING":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "PREPARING":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "READY":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "CANCELLED":
      return "bg-rose-50 text-rose-700 border-rose-200";
    default:
      return "bg-slate-50 text-slate-700 border-slate-200";
  }
};

const StatusIcon = ({ status }) => {
  const normalized = String(status || "").toUpperCase();
  switch (normalized) {
    case "COMPLETED":
      return <FiCheckCircle className="h-3.5 w-3.5" />;
    case "CANCELLED":
      return <FiXCircle className="h-3.5 w-3.5" />;
    case "PENDING":
      return <FiClock className="h-3.5 w-3.5" />;
    default:
      return null;
  }
};

const RecentOrders = ({ orders, loading, onStatusChange, onDelete }) => {
  if (loading) {
    return <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />;
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">
        <FiShoppingBag className="mx-auto mb-2 h-8 w-8 text-slate-300" aria-hidden="true" />
        No recent orders found.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <FiShoppingBag className="h-5 w-5 text-emerald-600" aria-hidden="true" />
        <h3 className="text-lg font-semibold text-slate-900">Recent Orders</h3>
      </div>
      <div className="space-y-3">
        {orders.slice(0, 5).map((order) => (
          <div key={order._id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3 transition-colors hover:bg-slate-50">
            <div className="flex items-center gap-2.5 min-w-0">
              <FiShoppingBag className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">#{order.orderNumber}</p>
                <div className="flex items-center gap-1">
                  <FiUser className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
                  <p className="truncate text-xs text-slate-500">{order.customer || "Guest"}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass(order.status)}`}>
                <StatusIcon status={order.status} />
                {order.status || "Pending"}
              </span>
              <div className="flex items-center gap-1">
                <FiDollarSign className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                <span className="text-sm font-semibold text-slate-900">{currency(order.amount)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default memo(RecentOrders);
