import { FiPlus, FiSearch } from "react-icons/fi";

const TableToolbar = ({ filters, onChange, onAdd, floors, sections }) => {
  const update = (key, value) => onChange({ ...filters, [key]: value });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={filters.search}
            onChange={(e) => update("search", e.target.value)}
            placeholder="Search tables..."
            className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-slate-400 focus:outline-none"
          />
        </div>

        <select
          value={filters.floor}
          onChange={(e) => update("floor", e.target.value)}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All Floors</option>
          {floors.map((floor) => (
            <option key={floor} value={floor}>{floor}</option>
          ))}
        </select>

        <select
          value={filters.status}
          onChange={(e) => update("status", e.target.value)}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All Status</option>
          <option value="AVAILABLE">Available</option>
          <option value="OCCUPIED">Occupied</option>
          <option value="RESERVED">Reserved</option>
          <option value="MAINTENANCE">Maintenance</option>
        </select>

        <button
          onClick={onAdd}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
        >
          <FiPlus />
          <span>Add Table</span>
        </button>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <select
          value={filters.section}
          onChange={(e) => update("section", e.target.value)}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">All Sections</option>
          {sections.map((section) => (
            <option key={section} value={section}>{section}</option>
          ))}
        </select>

        <select
          value={filters.capacity}
          onChange={(e) => update("capacity", e.target.value)}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Any Capacity</option>
          <option value="2">2+ Guests</option>
          <option value="4">4+ Guests</option>
          <option value="6">6+ Guests</option>
          <option value="8">8+ Guests</option>
        </select>

        <select
          value={filters.sortBy}
          onChange={(e) => update("sortBy", e.target.value)}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="tableNumber">Sort: Table Number</option>
          <option value="capacity">Sort: Capacity</option>
          <option value="status">Sort: Status</option>
        </select>

        <select
          value={filters.order}
          onChange={(e) => update("order", e.target.value)}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>
      </div>
    </div>
  );
};

export default TableToolbar;
