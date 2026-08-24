import { FiEdit2, FiEye, FiTrash2, FiUsers, FiShoppingBag, FiCheckCircle } from "react-icons/fi";
import TableStatusBadge from "./TableStatusBadge";

const statusChoices = ["AVAILABLE", "OCCUPIED", "RESERVED", "MAINTENANCE"];

const TableCard = ({ table, onEdit, onView, onDelete, onStatusChange, statusUpdating, onTableClick, onSelect, selected }) => {
  const hasActiveOrder = table?.currentOrder && String(table.status || "").toUpperCase() === "OCCUPIED";
  const orderNumber = table?.currentOrder?.orderNumber;
  const orderTotal = table?.currentOrder?.total;
  const itemCount = table?.currentOrder?.items?.length || 0;

  const stop = (handler) => (event) => {
    event.stopPropagation();
    handler?.(table);
  };

  const handleSelect = () => onSelect?.(table);

  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleSelect();
    }
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
      className={`cursor-pointer rounded-2xl border p-4 shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-300 ${
        selected
          ? "border-brand-500 bg-brand-50 ring-1 ring-brand-300"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Table {table.tableNumber}</h3>
          <p className="text-xs text-slate-500">{table.floor}</p>
        </div>
        <div className="flex items-center gap-2">
          {selected && (
            <FiCheckCircle className="text-brand-600" aria-hidden="true" />
          )}
          <button
            onClick={stop(onDelete)}
            className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
            aria-label={`Delete table ${table.tableNumber}`}
          >
            <FiTrash2 />
          </button>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-3 py-4 text-center">
        <p className="text-3xl" role="img" aria-label="chair">🪑</p>
        <p className="mt-1 text-xl font-bold text-slate-900">{table.tableNumber}</p>
      </div>

      <div className="mt-4 space-y-1 text-sm text-slate-700">
        <p className="inline-flex items-center gap-2">
          <FiUsers className="text-slate-500" aria-hidden="true" />
          <span>Capacity: {table.capacity} Guests</span>
        </p>
        <p>Section: {table.section}</p>
        <p>Shape: {String(table.shape || "SQUARE").toLowerCase()}</p>
        {hasActiveOrder && (
          <>
            <p className="inline-flex items-center gap-2 text-brand-700">
              <FiShoppingBag className="text-brand-700" aria-hidden="true" />
              <span className="font-medium">{orderNumber ? `Order ${orderNumber}` : "Active Order"}</span>
            </p>
            {itemCount > 0 && <p>Items: {itemCount}</p>}
            {typeof orderTotal === "number" && <p>Total: ₹{orderTotal}</p>}
          </>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <TableStatusBadge status={table.status} />
        <select
          value={String(table.status || "AVAILABLE").toUpperCase()}
          onChange={(e) => onStatusChange(table, e.target.value)}
          onClick={(e) => e.stopPropagation()}
          disabled={statusUpdating}
          aria-label={`Change status for table ${table.tableNumber}`}
          className="rounded-lg border border-slate-300 px-2 py-1 text-xs"
        >
          {statusChoices.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={stop(onEdit)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
          <span className="inline-flex items-center gap-1"><FiEdit2 /> Edit</span>
        </button>
        <button onClick={stop(onView)} className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800">
          <span className="inline-flex items-center gap-1"><FiEye /> View</span>
        </button>
      </div>

      {onTableClick && (
        <button
          onClick={stop(onTableClick)}
          className="mt-2 w-full rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100"
        >
          {hasActiveOrder ? "View Active Order" : "Create New Order"}
        </button>
      )}
    </article>
  );
};

export default TableCard;
