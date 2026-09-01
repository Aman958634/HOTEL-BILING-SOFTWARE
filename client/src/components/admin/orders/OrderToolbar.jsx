import { memo, useCallback, useEffect, useState } from "react";
import { FiCalendar, FiChevronDown, FiChevronUp, FiPlus, FiSearch, FiX } from "react-icons/fi";

const OrderToolbar = ({ filters, onChange, onCreate }) => {
  const [search, setSearch] = useState(filters.search);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setSearch(filters.search);
  }, [filters.search]);

  useEffect(() => {
    if (search === filters.search) return undefined;
    const timer = setTimeout(() => onChange({ ...filters, search, page: 1 }), 300);
    return () => clearTimeout(timer);
  }, [filters, onChange, search]);

  const setField = useCallback((key, value) => onChange({ ...filters, [key]: value, page: 1 }), [filters, onChange]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4" aria-label="Order filters">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 lg:gap-3 xl:grid-cols-[1.5fr_repeat(3,minmax(0,1fr))_auto]">
        <div className="relative min-w-0 sm:col-span-2 lg:col-span-1">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="min-h-11 w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15"
            placeholder="Search orders"
            aria-label="Search orders"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select className="min-h-11 min-w-0 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15" value={filters.status} onChange={(e) => setField("status", e.target.value)} aria-label="Filter by order status">
          <option value="">Status: All</option>
          <option value="PENDING">Pending</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="PREPARING">Preparing</option>
          <option value="READY">Ready</option>
          <option value="SERVED">Served</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        <select className="min-h-11 min-w-0 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15" value={filters.paymentStatus} onChange={(e) => setField("paymentStatus", e.target.value)} aria-label="Filter by payment status">
          <option value="">Payment: All</option>
          <option value="PENDING">Pending</option>
          <option value="PAID">Paid</option>
          <option value="FAILED">Failed</option>
          <option value="REFUNDED">Refunded</option>
        </select>

        <button type="button" onClick={onCreate} className="hidden min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-medium text-white lg:inline-flex">
          <FiPlus aria-hidden="true" />
          <span>Create Order</span>
        </button>
      </div>

      <button type="button" onClick={() => setMoreOpen((open) => !open)} className="mt-2 inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-slate-600 lg:hidden" aria-expanded={moreOpen} aria-controls="order-more-filters">
        More filters {moreOpen ? <FiChevronUp aria-hidden="true" /> : <FiChevronDown aria-hidden="true" />}
      </button>
      <div id="order-more-filters" className={`${moreOpen ? "grid" : "hidden"} mt-2 grid-cols-1 gap-2 sm:grid-cols-2 lg:mt-3 lg:grid lg:grid-cols-3 lg:gap-3`}>
        <select className="min-h-11 min-w-0 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15" value={filters.orderType} onChange={(e) => setField("orderType", e.target.value)} aria-label="Filter by order type">
          <option value="">Order Type: All</option>
          <option value="DINE_IN">Dine In</option>
          <option value="TAKEAWAY">Takeaway</option>
          <option value="DELIVERY">Delivery</option>
        </select>

        <div className="relative min-w-0">
          <FiCalendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="date"
            className="min-h-11 w-full rounded-xl border border-slate-300 py-2 pl-9 pr-9 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15"
            value={filters.date}
            onChange={(e) => setField("date", e.target.value)}
          />
          {filters.date ? (
            <button
              type="button"
              onClick={() => setField("date", "")}
              className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:text-slate-600"
              aria-label="Clear date filter"
            >
              <FiX />
            </button>
          ) : null}
        </div>

        <select className="min-h-11 min-w-0 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15" value={filters.sortBy} onChange={(e) => setField("sortBy", e.target.value)} aria-label="Sort orders">
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="amount_high">Highest Amount</option>
          <option value="amount_low">Lowest Amount</option>
        </select>
      </div>
    </section>
  );
};

export default memo(OrderToolbar);
