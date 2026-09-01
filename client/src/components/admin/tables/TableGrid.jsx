import { memo } from "react";
import TableCard from "./TableCard";
import { FiGrid } from "react-icons/fi";
import EmptyState from "../../common/EmptyState";

const TableGrid = ({
  tables,
  loading,
  onEdit,
  onDelete,
  onAddFirst,
  hasFilters = false,
  onClearFilters,
  onTableClick,
  onSelect,
  selectedId,
}) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" aria-busy="true">
        {Array.from({ length: 8 }).map((_, index) => (
          <div key={index} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-3 sm:p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-5 w-24 rounded bg-slate-200" />
                <div className="h-3 w-36 max-w-full rounded bg-slate-100" />
              </div>
              <div className="h-7 w-20 shrink-0 rounded-full bg-slate-100" />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-2.5">
              <div className="h-9 rounded bg-slate-100" />
              <div className="h-9 rounded bg-slate-100" />
            </div>
            <div className="mt-3 h-11 rounded-xl bg-slate-100" />
          </div>
        ))}
      </div>
    );
  }

  if (!tables.length) {
    return (
      <EmptyState
        icon={<FiGrid className="h-10 w-10" />}
        title={hasFilters ? "No matching tables" : "No tables yet"}
        description={hasFilters ? "Try changing your search or filters." : "Add tables to start managing dine-in service."}
        action={hasFilters ? <button type="button" onClick={onClearFilters} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Clear filters</button> : <button type="button" onClick={onAddFirst} className="min-h-11 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800">+ Add Table</button>}
          action={hasFilters ? <button type="button" onClick={onClearFilters} className="min-h-11 w-full rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 sm:w-auto">Clear filters</button> : <button type="button" onClick={onAddFirst} className="min-h-11 w-full rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 sm:w-auto">+ Add Table</button>}
      />
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3 2xl:grid-cols-4">
      {tables.map((table) => (
        <TableCard
          key={table._id}
          table={table}
          onEdit={onEdit}
          onDelete={onDelete}
          onTableClick={onTableClick}
          onSelect={onSelect}
          selected={selectedId === table._id}
        />
      ))}
    </div>
  );
};

export default memo(TableGrid);
