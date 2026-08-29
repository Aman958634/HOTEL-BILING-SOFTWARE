import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { globalSearch } from "../../services/searchService";
import {
  FiBox,
  FiCalendar,
  FiChevronRight,
  FiCoffee,
  FiCreditCard,
  FiFileText,
  FiGrid,
  FiSearch,
  FiShoppingBag,
  FiTag,
  FiUsers,
  FiX,
} from "react-icons/fi";

const MIN_QUERY_LENGTH = 2;
const categoryMeta = {
  orders: { label: "Orders", icon: FiShoppingBag },
  onlineOrders: { label: "Online orders", icon: FiShoppingBag },
  customers: { label: "Customers", icon: FiUsers },
  bills: { label: "Bills", icon: FiFileText },
  payments: { label: "Payments", icon: FiCreditCard },
  tables: { label: "Tables", icon: FiGrid },
  staff: { label: "Staff", icon: FiUsers },
  menuItems: { label: "Menu", icon: FiTag },
  kots: { label: "Kitchen tickets", icon: FiCoffee },
  reservations: { label: "Reservations", icon: FiCalendar },
  inventory: { label: "Inventory", icon: FiBox },
  loyalty: { label: "Loyalty", icon: FiTag },
  centralKitchen: { label: "Central Kitchen", icon: FiCoffee },
};

const isEditableTarget = (target) => {
  const tag = String(target?.tagName || "").toLowerCase();
  return tag === "input" || tag === "textarea" || target?.isContentEditable;
};

const GlobalSearch = ({ className = "", compact = false }) => {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const requestRef = useRef(null);
  const debounceRef = useRef(null);
  const requestIdRef = useRef(0);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState({});
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const groupedResults = useMemo(() => Object.entries(results)
    .filter(([type, rows]) => categoryMeta[type] && Array.isArray(rows) && rows.length)
    .map(([type, rows]) => ({ type, rows })), [results]);
  const flatResults = useMemo(() => groupedResults.flatMap(({ type, rows }) => rows.map((row) => ({ ...row, type }))), [groupedResults]);

  const cancelPending = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = null;
    requestRef.current?.abort();
    requestRef.current = null;
  }, []);

  const close = useCallback(() => {
    cancelPending();
    setOpen(false);
    setQuery("");
    setResults({});
    setLoading(false);
    setError("");
    setActiveIndex(0);
  }, [cancelPending]);

  const executeSearch = useCallback(async (value) => {
    const term = String(value || "").trim();
    if (term.length < MIN_QUERY_LENGTH) {
      setResults({});
      setLoading(false);
      setError("");
      return;
    }
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError("");
    try {
      const { data } = await globalSearch(term, { limit: 5, signal: controller.signal });
      if (requestId !== requestIdRef.current) return;
      setResults(data?.data?.results || {});
      setActiveIndex(0);
      setOpen(true);
    } catch (requestError) {
      if (requestError?.code === "ERR_CANCELED" || controller.signal.aborted || requestId !== requestIdRef.current) return;
      setResults({});
      setError(requestError?.response?.data?.message || "Unable to search right now.");
      setOpen(true);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  const scheduleSearch = useCallback((value) => {
    cancelPending();
    if (String(value || "").trim().length < MIN_QUERY_LENGTH) {
      setResults({});
      setLoading(false);
      setError("");
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => executeSearch(value), 300);
  }, [cancelPending, executeSearch]);

  useEffect(() => () => cancelPending(), [cancelPending]);
  useEffect(() => {
    const onEscape = (event) => {
      if (event.key === "Escape" && open) close();
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [close, open]);
  useEffect(() => {
    const onShortcut = (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k" || isEditableTarget(event.target)) return;
      event.preventDefault();
      setOpen(true);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    };
    document.addEventListener("keydown", onShortcut);
    return () => document.removeEventListener("keydown", onShortcut);
  }, []);

  const select = useCallback((item) => {
    if (!item?.route) return;
    navigate(item.route);
    close();
  }, [close, navigate]);

  const onInputKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
    } else if (event.key === "ArrowDown" && flatResults.length) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, flatResults.length - 1));
    } else if (event.key === "ArrowUp" && flatResults.length) {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && flatResults[activeIndex]) {
      event.preventDefault();
      select(flatResults[activeIndex]);
    }
  };

  const onChange = (event) => {
    const value = event.target.value;
    setQuery(value);
    setOpen(Boolean(value.trim()));
    scheduleSearch(value);
  };

  const clear = () => {
    cancelPending();
    setQuery("");
    setResults({});
    setError("");
    setLoading(false);
    setActiveIndex(0);
    inputRef.current?.focus();
  };

  const panel = open ? <SearchPanel
    compact={compact}
    query={query}
    loading={loading}
    error={error}
    groupedResults={groupedResults}
    activeIndex={activeIndex}
    onActive={setActiveIndex}
    onSelect={select}
    onRetry={() => executeSearch(query)}
  /> : null;

  if (compact) {
    return <div className={className}>
      <button type="button" onClick={() => { setOpen(true); window.setTimeout(() => inputRef.current?.focus(), 0); }} className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100" aria-label="Search records">
        <FiSearch className="h-5 w-5" />
      </button>
      {open ? <div className="fixed inset-0 z-[70] bg-slate-950/40 p-3 sm:p-6"><div className="mx-auto flex h-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"><SearchInput inputRef={inputRef} query={query} onChange={onChange} onFocus={() => query.trim() && setOpen(true)} onKeyDown={onInputKeyDown} onClear={clear} onClose={close} fullWidth />{panel}</div></div> : null}
    </div>;
  }

  return <div className={`relative ${className}`}>
    <SearchInput inputRef={inputRef} query={query} onChange={onChange} onFocus={() => query.trim() && setOpen(true)} onKeyDown={onInputKeyDown} onClear={clear} />
    {panel}
  </div>;
};

const SearchInput = ({ inputRef, query, onChange, onFocus, onKeyDown, onClear, onClose, fullWidth = false }) => <div className={`relative ${fullWidth ? "p-3 sm:p-4" : ""}`}>
  <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
  <input ref={inputRef} value={query} onChange={onChange} onFocus={onFocus} onKeyDown={onKeyDown} aria-label="Search orders, customers, payments, and more" aria-autocomplete="list" className={`h-10 rounded-xl border border-slate-200 py-2 pl-9 text-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 ${fullWidth ? "w-full pr-20" : "w-64 pr-16"}`} placeholder="Search records…" />
  {query ? <button type="button" onClick={onClear} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:text-slate-700" aria-label="Clear search"><FiX className="h-4 w-4" /></button> : null}
  {fullWidth && onClose ? <button type="button" onClick={onClose} className="absolute right-10 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500">Close</button> : null}
</div>;

const SearchPanel = ({ compact, query, loading, error, groupedResults, activeIndex, onActive, onSelect, onRetry }) => {
  const rows = groupedResults.flatMap(({ type, rows: groupRows }) => groupRows.map((item) => ({ type, item })));
  const noResults = !loading && !error && query.trim().length >= MIN_QUERY_LENGTH && !rows.length;
  const content = <>
    {loading ? <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-500"><span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-600" />Searching authorized records…</div> : null}
    {error && !loading ? <div className="px-4 py-4 text-sm text-rose-700"><p>{error}</p><button type="button" onClick={onRetry} className="mt-2 font-semibold text-emerald-700 hover:underline">Retry</button></div> : null}
    {!loading && !error && query.trim().length > 0 && query.trim().length < MIN_QUERY_LENGTH ? <p className="px-4 py-3 text-sm text-slate-500">Enter at least {MIN_QUERY_LENGTH} characters to search.</p> : null}
    {noResults ? <p className="px-4 py-5 text-sm text-slate-500">No results found for “{query.trim()}”. Try an order number, customer, bill, or payment reference.</p> : null}
    {!loading && !error ? groupedResults.map(({ type, rows: groupRows }) => {
      const MetaIcon = categoryMeta[type].icon;
      return <section key={type} className="border-b border-slate-100 last:border-b-0"><p className="flex items-center gap-2 px-4 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-400"><MetaIcon className="h-4 w-4" />{categoryMeta[type].label}</p>{groupRows.map((item) => {
        const index = rows.findIndex((entry) => entry.item.id === item.id && entry.type === type);
        const selected = index === activeIndex;
        return <button key={item.id} type="button" role="option" aria-selected={selected} onMouseEnter={() => onActive(index)} onClick={() => onSelect(item)} className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${selected ? "bg-emerald-50" : "hover:bg-slate-50"}`}><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-900">{item.title}</span>{item.subtitle ? <span className="block truncate text-xs text-slate-500">{item.subtitle}</span> : null}</span><FiChevronRight className="h-4 w-4 shrink-0 text-slate-400" /></button>;
      })}</section>;
    }) : null}
  </>;
  return compact ? <div role="listbox" aria-label="Global search results" className="min-h-0 flex-1 overflow-y-auto">{content}</div> : <div role="listbox" aria-label="Global search results" className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[70vh] min-w-[24rem] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl">{content}</div>;
};

export default GlobalSearch;
