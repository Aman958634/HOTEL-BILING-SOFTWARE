import { memo } from "react";
import { currency } from "../../utils/format";
import { FiCheckCircle, FiClock, FiDollarSign, FiShoppingBag, FiUser, FiXCircle } from "react-icons/fi";

const statusBadgeClass = (status) => {
  switch (String(status || "").toUpperCase()) {
    case "COMPLETED": return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "PENDING": return "border-amber-200 bg-amber-50 text-amber-700";
    case "PREPARING": return "border-blue-200 bg-blue-50 text-blue-700";
    case "READY": return "border-indigo-200 bg-indigo-50 text-indigo-700";
    case "CANCELLED": return "border-rose-200 bg-rose-50 text-rose-700";
    default: return "border-slate-200 bg-slate-50 text-slate-700";
  }
};

const StatusIcon = ({ status }) => {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "COMPLETED") return <FiCheckCircle className="h-3.5 w-3.5 shrink-0" />;
  if (normalized === "CANCELLED") return <FiXCircle className="h-3.5 w-3.5 shrink-0" />;
  if (normalized === "PENDING") return <FiClock className="h-3.5 w-3.5 shrink-0" />;
  return null;
};

const orderTime = (date) => new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(date));

const RecentOrders = ({ orders, loading, error, onRetry }) => {
  if (loading) return <div className="h-64 animate-pulse rounded-2xl bg-slate-100 sm:h-72" aria-busy="true" />;

  if (error) {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-center text-sm text-rose-700" role="alert"><p>Unable to load recent orders.</p><button type="button" onClick={onRetry} className="mt-3 min-h-10 rounded-lg bg-rose-700 px-3 text-sm font-semibold text-white hover:bg-rose-800">Retry</button></div>;
  }

  if (!orders.length) {
    return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-500 sm:p-6"><FiShoppingBag className="mx-auto mb-2 h-8 w-8 text-slate-300" aria-hidden="true" />No recent orders yet.</div>;
  }

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4 md:p-5" aria-labelledby="recent-orders-title">
      <div className="mb-3 flex items-center gap-2 sm:mb-4"><FiShoppingBag className="h-5 w-5 text-emerald-600" aria-hidden="true" /><h3 id="recent-orders-title" className="text-lg font-semibold text-slate-900">Recent Orders</h3></div>
      <div className="space-y-2.5 sm:space-y-3">
        {orders.slice(0, 5).map((order) => (
          <article key={order._id} className="min-w-0 rounded-xl border border-slate-100 p-3 transition-colors hover:bg-slate-50">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5"><FiShoppingBag className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" /><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">#{order.orderNumber}</p><div className="flex min-w-0 items-center gap-1"><FiUser className="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" /><p className="truncate text-xs text-slate-500">{order.customer || "Guest"}</p></div></div></div>
              <div className="flex shrink-0 items-center gap-1"><FiDollarSign className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" /><span className="text-sm font-semibold text-slate-900">{currency(order.amount)}</span></div>
            </div>
            <div className="mt-2 flex min-w-0 items-center justify-between gap-2"><span className={`inline-flex min-w-0 items-center gap-1 truncate rounded-full border px-2 py-1 text-[11px] font-medium ${statusBadgeClass(order.status)}`}><StatusIcon status={order.status} />{order.status || "Pending"}</span><time className="shrink-0 text-[11px] text-slate-500" dateTime={order.date}>{orderTime(order.date)}</time></div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default memo(RecentOrders);
