import TableCard from "./TableCard";

const TableGrid = ({
  tables,
  loading,
  onEdit,
  onView,
  onDelete,
  onStatusChange,
  onAddFirst,
  statusUpdatingId,
}) => {
  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="mb-4 text-sm text-slate-500">Loading tables...</p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="h-56 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      </div>
    );
  }

  if (!tables.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">No restaurant tables found.</h3>
        <p className="mt-2 text-sm text-slate-500">Create your table plan to start managing occupancy and reservations.</p>
        <button onClick={onAddFirst} className="mt-4 rounded-xl bg-brand-700 px-4 py-2 text-sm text-white">
          Add Your First Table
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {tables.map((table) => (
        <TableCard
          key={table._id}
          table={table}
          onEdit={onEdit}
          onView={onView}
          onDelete={onDelete}
          onStatusChange={onStatusChange}
          statusUpdating={statusUpdatingId === table._id}
        />
      ))}
    </div>
  );
};

export default TableGrid;
