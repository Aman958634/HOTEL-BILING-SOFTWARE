import { FiDownload, FiFilter, FiSearch, FiX } from "react-icons/fi";
import { paymentMethodOptions, paymentRangeOptions, paymentStatusOptions } from "../../utils/paymentUtils";

const fieldClass = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-700 focus:ring-2 focus:ring-brand-100";

const PaymentFilters = ({
  filters,
  onChange,
  onExport,
  onReset,
  mobileOpen = false,
  onClose,
  variant = "desktop",
}) => {
  const content = (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-5">
        <label className="relative lg:col-span-2">
          <FiSearch className="pointer-events-none absolute left-3 top-3 text-slate-400" />
          <input
            aria-label="Search payments"
            className={`${fieldClass} pl-9`}
            value={filters.search}
            onChange={(event) => onChange({ search: event.target.value, page: 1 })}
            placeholder="Search payment, order, customer, phone"
          />
        </label>

        <select aria-label="Payment period" className={fieldClass} value={filters.range} onChange={(event) => onChange({ range: event.target.value, page: 1 })}>
          {paymentRangeOptions.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select aria-label="Payment status" className={fieldClass} value={filters.status} onChange={(event) => onChange({ status: event.target.value, page: 1 })}>
          {paymentStatusOptions.map((option) => (
            <option key={option.value || "all-statuses"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select aria-label="Payment method" className={fieldClass} value={filters.method} onChange={(event) => onChange({ method: event.target.value, page: 1 })}>
          {paymentMethodOptions.map((option) => (
            <option key={option.value || "all-methods"} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {filters.range === "custom" ? (
        <div className="grid gap-3 lg:grid-cols-3">
          <input aria-label="Start date" className={fieldClass} type="date" value={filters.startDate} onChange={(event) => onChange({ startDate: event.target.value, page: 1 })} />
          <input aria-label="End date" className={fieldClass} type="date" value={filters.endDate} onChange={(event) => onChange({ endDate: event.target.value, page: 1 })} />
          <div className="flex gap-2">
            <button onClick={onReset} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm text-slate-700">
              <FiX /> Reset
            </button>
            <button onClick={onExport} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-800">
              <FiDownload /> Export
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button onClick={onReset} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm text-slate-700">
            Clear Filters
          </button>
          <button onClick={onExport} className="flex min-h-11 items-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-800">
            <FiDownload /> Export
          </button>
        </div>
      )}
    </div>
  );

  if (variant === "mobile") {
    return (
      <div className={`fixed inset-0 z-50 lg:hidden ${mobileOpen ? "pointer-events-auto" : "pointer-events-none"}`}>
        <div className={`absolute inset-0 bg-slate-900/50 transition-opacity ${mobileOpen ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
        <div className={`absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-slate-50 p-4 shadow-2xl transition-transform ${mobileOpen ? "translate-x-0" : "translate-x-full"}`}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-lg font-semibold text-slate-900">Filters</p>
              <p className="text-sm text-slate-500">Narrow payment transactions.</p>
            </div>
            <button onClick={onClose} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-600" aria-label="Close payment filters">
              <FiX />
            </button>
          </div>
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="rounded-xl bg-slate-100 p-2 text-brand-700">
          <FiFilter />
        </span>
        <div>
          <h3 className="text-base font-semibold text-slate-900">Payment Filters</h3>
          <p className="text-sm text-slate-500">Search, filter and export payment transactions.</p>
        </div>
      </div>
      {content}
    </div>
  );
};

export default PaymentFilters;
