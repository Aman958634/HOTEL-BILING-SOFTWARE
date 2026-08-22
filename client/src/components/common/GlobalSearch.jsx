import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { globalSearch } from "../../services/searchService";
import {
  FiBookOpen,
  FiCalendar,
  FiChevronDown,
  FiCreditCard,
  FiFileText,
  FiGrid,
  FiSearch,
  FiShoppingBag,
  FiTag,
  FiUsers,
  FiX,
} from "react-icons/fi";

const LIMIT_PER_CATEGORY = 5;

const categoryMeta = {
  orders: { label: "Orders", icon: <FiShoppingBag className="h-4 w-4" /> },
  menuItems: { label: "Menu Items", icon: <FiBookOpen className="h-4 w-4" /> },
  categories: { label: "Categories", icon: <FiTag className="h-4 w-4" /> },
  staff: { label: "Staff", icon: <FiUsers className="h-4 w-4" /> },
  tables: { label: "Tables", icon: <FiGrid className="h-4 w-4" /> },
  payments: { label: "Payments", icon: <FiCreditCard className="h-4 w-4" /> },
  reservations: { label: "Reservations", icon: <FiCalendar className="h-4 w-4" /> },
  subscriptions: { label: "Subscriptions", icon: <FiFileText className="h-4 w-4" /> },
};

const routeForCategory = (category) => {
  switch (category) {
    case "orders":
      return "/dashboard/admin/orders";
    case "menuItems":
      return "/dashboard/admin/menu";
    case "categories":
      return "/dashboard/admin/categories";
    case "staff":
      return "/dashboard/admin/staff";
    case "tables":
      return "/dashboard/admin/tables";
    case "payments":
      return "/dashboard/admin/payments";
    case "reservations":
      return "/reservation";
    case "subscriptions":
      return "/dashboard/admin/my-subscription";
    default:
      return "/dashboard/admin";
  }
};

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  return `₹${amount.toLocaleString("en-IN")}`;
};

const GlobalSearch = ({ className = "" }) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  const close = useCallback(() => {
    setOpen(false);
    setResults(null);
    setError("");
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [close]);

  useEffect(() => {
    const onOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        close();
      }
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [close]);

  const runSearch = useCallback(async (term) => {
    const trimmed = String(term || "").trim();
    if (trimmed.length < 2) {
      setResults(null);
      setError("");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const { data } = await globalSearch(trimmed);
      setResults(data?.data || null);
      setOpen(true);
    } catch (err) {
      setError("Unable to search. Try again.");
      setResults(null);
      setOpen(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const onChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 2) {
      setResults(null);
      setError("");
      setLoading(false);
      setOpen(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => {
      runSearch(value);
    }, 300);
  };

  const onClear = () => {
    setQuery("");
    setResults(null);
    setError("");
    setLoading(false);
    setOpen(false);
    inputRef.current?.focus();
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const first = findFirstResult(results);
      if (first) {
        navigate(first.route);
        close();
      }
    }
  };

  const onResultClick = (category, item) => {
    navigate(routeForCategory(category));
    close();
  };

  const hasResults = results && Object.values(results).some((arr) => Array.isArray(arr) && arr.length > 0);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <label className="relative block">
        <FiSearch className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
        <input
          ref={inputRef}
          value={query}
          onChange={onChange}
          onKeyDown={onKeyDown}
          onFocus={() => {
            if (results || loading || error) setOpen(true);
          }}
          className="h-10 w-64 rounded-xl border border-slate-200 py-2 pl-9 pr-10 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
          placeholder="Search anything..."
        />
        {query && (
          <button
            type="button"
            onClick={onClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:text-slate-600"
            aria-label="Clear search"
          >
            <FiX className="h-4 w-4" />
          </button>
        )}
      </label>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[70vh] min-w-[16rem] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl sm:min-w-[24rem]">
          {loading && (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-500">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-600" />
              Searching...
            </div>
          )}

          {error && !loading && (
            <div className="px-4 py-3 text-sm text-rose-600">{error}</div>
          )}

          {!loading && !error && !hasResults && query.trim().length >= 2 && (
            <div className="px-4 py-3 text-sm text-slate-500">No results found</div>
          )}

          {!loading && !error && hasResults && (
            <div>
              {Object.entries(results).map(([category, items]) => {
                if (!Array.isArray(items) || items.length === 0) return null;
                const meta = categoryMeta[category];
                if (!meta) return null;

                return (
                  <div key={category}>
                    <div className="flex items-center gap-2 px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {meta.icon}
                      {meta.label}
                    </div>
                    {items.slice(0, LIMIT_PER_CATEGORY).map((item) => (
                      <ResultRow
                        key={item.id}
                        category={category}
                        item={item}
                        onClick={() => onResultClick(category, item)}
                      />
                    ))}
                  </div>
                );
              })}
              <div className="border-t border-slate-100 px-4 py-2">
                <button
                  type="button"
                  onClick={() => {
                    navigate(routeForCategory(Object.keys(results).find((k) => (results[k] || []).length > 0) || "orders"));
                    close();
                  }}
                  className="text-left text-xs font-medium text-emerald-700 hover:text-emerald-800"
                >
                  View all results →
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const ResultRow = ({ category, item, onClick }) => {
  const label = getResultLabel(category, item);
  const sub = getResultSubtext(category, item);

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col gap-0.5 px-4 py-2 text-left transition-colors hover:bg-slate-50"
    >
      <span className="text-sm font-medium text-slate-900">{label}</span>
      {sub && <span className="text-xs text-slate-500">{sub}</span>}
    </button>
  );
};

const getResultLabel = (category, item) => {
  switch (category) {
    case "orders":
      return `#${item.orderNumber}`;
    case "menuItems":
      return item.name;
    case "categories":
      return item.name;
    case "staff":
      return item.fullName;
    case "tables":
      return `Table ${item.tableNumber}`;
    case "payments":
      return item.paymentId;
    case "reservations":
      return item.customerName || "Reservation";
    case "subscriptions":
      return item.planName;
    default:
      return "Result";
  }
};

const getResultSubtext = (category, item) => {
  switch (category) {
    case "orders":
      return `${item.customerName} · ${formatCurrency(item.total)}`;
    case "menuItems":
      return `${formatCurrency(item.price)}`;
    case "categories":
      return "Category";
    case "staff":
      return `${item.role}${item.email ? ` · ${item.email}` : ""}`;
    case "tables":
      return item.status;
    case "payments":
      return `${formatCurrency(item.amount)} · ${item.paymentMethod || ""} ${item.paymentStatus ? `· ${item.paymentStatus}` : ""}`.trim();
    case "reservations":
      return `${item.tableNumber ? `Table ${item.tableNumber}` : ""} ${item.status ? `· ${item.status}` : ""}`.trim();
    case "subscriptions":
      return `${item.billingCycle === "yearly" ? "Yearly" : "Monthly"} · ${item.status}`;
    default:
      return "";
  }
};

const findFirstResult = (results) => {
  if (!results) return null;
  for (const category of Object.keys(results)) {
    const items = results[category];
    if (Array.isArray(items) && items.length > 0) {
      return { route: routeForCategory(category), category, item: items[0] };
    }
  }
  return null;
};

export default GlobalSearch;
