import { memo, useCallback, useEffect, useState } from "react";
import { FiChevronDown, FiChevronUp, FiSearch } from "react-icons/fi";

const fieldClass = "min-h-11 min-w-0 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15";

const TableToolbar = ({ filters, onChange, floors, sections }) => {
  const [search, setSearch] = useState(filters.search);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => { setSearch(filters.search); }, [filters.search]);
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (search !== filters.search) onChange((previous) => ({ ...previous, search }));
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [filters.search, onChange, search]);

  const update = useCallback((key, value) => onChange((previous) => ({ ...previous, [key]: value })), [onChange]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4" aria-label="Table filters">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <select value={filters.status} onChange={(e) => update("status", e.target.value)} className={fieldClass} aria-label="Filter by status"><option value="">All Status</option><option value="AVAILABLE">Available</option><option value="OCCUPIED">Occupied</option><option value="RESERVED">Reserved</option><option value="MAINTENANCE">Maintenance</option></select>
        <select value={filters.floor} onChange={(e) => update("floor", e.target.value)} className={fieldClass} aria-label="Filter by floor"><option value="">All Floors</option>{floors.map((floor) => <option key={floor} value={floor}>{floor}</option>)}</select>
        <div className="relative col-span-2 min-w-0 sm:col-span-2"><FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search tables" className={`${fieldClass} pl-9`} aria-label="Search tables" /></div>
      </div>

      <button type="button" onClick={() => setMoreOpen((open) => !open)} className="mt-2 inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-slate-600 sm:hidden" aria-expanded={moreOpen} aria-controls="table-more-filters">More filters {moreOpen ? <FiChevronUp aria-hidden="true" /> : <FiChevronDown aria-hidden="true" />}</button>
      <div id="table-more-filters" className={`${moreOpen ? "grid" : "hidden"} mt-2 grid-cols-2 gap-2 sm:mt-3 sm:grid sm:grid-cols-4 sm:gap-3`}>
        <select value={filters.section} onChange={(e) => update("section", e.target.value)} className={fieldClass} aria-label="Filter by section"><option value="">All Sections</option>{sections.map((section) => <option key={section} value={section}>{section}</option>)}</select>
        <select value={filters.capacity} onChange={(e) => update("capacity", e.target.value)} className={fieldClass} aria-label="Filter by capacity"><option value="">Any Capacity</option><option value="2">2+ Guests</option><option value="4">4+ Guests</option><option value="6">6+ Guests</option><option value="8">8+ Guests</option></select>
        <select value={filters.sortBy} onChange={(e) => update("sortBy", e.target.value)} className={fieldClass} aria-label="Sort tables by"><option value="tableNumber">Table Number</option><option value="capacity">Capacity</option><option value="status">Status</option></select>
        <select value={filters.order} onChange={(e) => update("order", e.target.value)} className={fieldClass} aria-label="Sort direction"><option value="asc">Ascending</option><option value="desc">Descending</option></select>
      </div>
    </section>
  );
};

export default memo(TableToolbar);
