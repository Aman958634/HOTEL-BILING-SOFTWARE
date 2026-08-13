import { FiEdit2, FiEye, FiTrash2, FiUsers } from "react-icons/fi";
import TableStatusBadge from "./TableStatusBadge";

const statusChoices = ["AVAILABLE", "OCCUPIED", "RESERVED", "MAINTENANCE"];

const TableCard = ({ table, onEdit, onView, onDelete, onStatusChange, statusUpdating }) => {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Table {table.tableNumber}</h3>
          <p className="text-xs text-slate-500">{table.floor}</p>
        </div>
        <button
          onClick={() => onDelete(table)}
          className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
          aria-label={`Delete table ${table.tableNumber}`}
        >
          <FiTrash2 />
        </button>
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
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <TableStatusBadge status={table.status} />
        <select
          value={String(table.status || "AVAILABLE").toUpperCase()}
          onChange={(e) => onStatusChange(table, e.target.value)}
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
        <button onClick={() => onEdit(table)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
          <span className="inline-flex items-center gap-1"><FiEdit2 /> Edit</span>
        </button>
        <button onClick={() => onView(table)} className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800">
          <span className="inline-flex items-center gap-1"><FiEye /> View</span>
        </button>
      </div>
    </article>
  );
};

export default TableCard;
