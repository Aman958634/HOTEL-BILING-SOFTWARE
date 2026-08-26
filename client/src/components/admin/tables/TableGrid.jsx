import TableCard from "./TableCard";
import { FiGrid } from "react-icons/fi";
import EmptyState from "../../common/EmptyState";
import { SkeletonList } from "../../common/Skeletons";

const TableGrid = ({
  tables,
  loading,
  onEdit,
  onView,
  onDelete,
  onStatusChange,
  onAddFirst,
  statusUpdatingId,
  onTableClick,
  onSelect,
  selectedId,
}) => {
  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <SkeletonList count={8} className="h-56" />
      </div>
    );
  }

  if (!tables.length) {
    return (
      <EmptyState
        icon={<FiGrid className="h-10 w-10" />}
        title="No tables yet"
        description="Add your restaurant tables to start managing seating."
        action={<button onClick={onAddFirst} className="rounded-xl bg-brand-700 px-4 py-2 text-sm text-white">+ Add Table</button>}
      />
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
          onTableClick={onTableClick}
          onSelect={onSelect}
          selected={selectedId === table._id}
        />
      ))}
    </div>
  );
};

export default TableGrid;
