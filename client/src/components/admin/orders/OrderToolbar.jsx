import { FiPlus, FiSearch } from "react-icons/fi";

const OrderToolbar = ({ filters, onChange, onCreate }) => {
  const setField = (key, value) => onChange({ ...filters, [key]: value, page: 1 });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 xl:grid-cols-[1.5fr_repeat(4,minmax(0,1fr))_auto]">
        <div className="relative">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm"
            placeholder="Search Order..."
            value={filters.search}
            onChange={(e) => setField("search", e.target.value)}
          />
        </div>

        <select className="rounded-xl border border-slate-300 px-3 py-2 text-sm" value={filters.status} onChange={(e) => setField("status", e.target.value)}>
          <option value="">Status: All</option>
          <option value="PENDING">Pending</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="PREPARING">Preparing</option>
          <option value="READY">Ready</option>
          <option value="SERVED">Served</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        <select className="rounded-xl border border-slate-300 px-3 py-2 text-sm" value={filters.orderType} onChange={(e) => setField("orderType", e.target.value)}>
          <option value="">Order Type: All</option>
          <option value="DINE_IN">Dine In</option>
          <option value="TAKEAWAY">Takeaway</option>
          <option value="DELIVERY">Delivery</option>
        </select>

        <select className="rounded-xl border border-slate-300 px-3 py-2 text-sm" value={filters.paymentStatus} onChange={(e) => setField("paymentStatus", e.target.value)}>
          <option value="">Payment: All</option>
          <option value="PENDING">Pending</option>
          <option value="PAID">Paid</option>
          <option value="FAILED">Failed</option>
          <option value="REFUNDED">Refunded</option>
        </select>

        <input type="date" className="rounded-xl border border-slate-300 px-3 py-2 text-sm" value={filters.date} onChange={(e) => setField("date", e.target.value)} />

        <button onClick={onCreate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-sm font-medium text-white">
          <FiPlus />
          <span>Create Order</span>
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="text-xs text-slate-500">Sort by:</label>
        <select className="rounded-lg border border-slate-300 px-2 py-1 text-xs" value={filters.sortBy} onChange={(e) => setField("sortBy", e.target.value)}>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="amount_high">Highest Amount</option>
          <option value="amount_low">Lowest Amount</option>
        </select>
      </div>
    </div>
  );
};

export default OrderToolbar;
