import { memo } from "react";
import { FiEdit2, FiEye, FiShoppingBag, FiTrash2, FiUsers } from "react-icons/fi";
import { currency } from "../../../utils/format";
import TableStatusBadge from "./TableStatusBadge";

const TableCard = ({ table, onEdit, onDelete, onTableClick, onSelect, selected }) => {
  const activeOrderCount = Number(table?.activeOrderCount || 0);
  const activeOrders = Array.isArray(table?.activeOrders) ? table.activeOrders : [];
  const currentOrder = typeof table?.currentOrder === "object" ? table.currentOrder : null;
  const activeOrder = currentOrder || activeOrders[0] || null;
  const hasActiveOrder = activeOrderCount > 0 || Boolean(activeOrder);
  const orderNumber = activeOrder?.orderNumber;
  const orderTotal = activeOrder?.total;
  const hasOrderTotal = typeof orderTotal === "number" && Number.isFinite(orderTotal);
  const kitchenStatus = activeOrder?.kitchenStatus || activeOrder?.kotStatus;
  const stop = (handler) => (event) => {
    event.stopPropagation();
    handler?.(table);
  };

  return (
    <article className={`min-w-0 rounded-2xl border bg-white p-3 shadow-sm transition hover:shadow-md sm:p-4 ${selected ? "border-brand-500 bg-brand-50 ring-1 ring-brand-300" : "border-slate-200"}`}>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-base font-semibold text-slate-900 sm:text-lg">Table {table.tableNumber}</h3>
          <p className="mt-0.5 break-words text-xs text-slate-500" title={`${table.floor || "Unassigned floor"} / ${table.section || "Unassigned section"}`}>{table.floor || "Unassigned floor"} <span aria-hidden="true">/</span> {table.section || "Unassigned section"}</p>
        </div>
        <div className="shrink-0"><TableStatusBadge status={table.status} /></div>
      </div>

      {hasActiveOrder ? (
        <div className="mt-3 min-w-0 rounded-xl border border-brand-100 bg-brand-50/70 p-2.5 text-sm text-brand-800">
          <div className="flex min-w-0 items-center gap-2"><FiShoppingBag className="h-4 w-4 shrink-0" aria-hidden="true" /><span className="break-words font-semibold">{activeOrderCount > 1 ? `${activeOrderCount} active orders` : orderNumber ? `Order ${orderNumber}` : "Active order"}</span></div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-brand-700">
            {hasOrderTotal ? <span>Amount: {currency(orderTotal)}</span> : null}
            {activeOrder?.status ? <span>Order: {String(activeOrder.status).replaceAll("_", " ")}</span> : null}
            {kitchenStatus ? <span>Kitchen: {String(kitchenStatus).replaceAll("_", " ")}</span> : null}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">No active order</p>
      )}

      <dl className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-2.5 text-sm">
        <div className="min-w-0"><dt className="text-[11px] uppercase tracking-wide text-slate-500">Capacity</dt><dd className="mt-0.5 flex items-center gap-1 truncate font-medium text-slate-800"><FiUsers className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />{table.capacity} guests</dd></div>
        <div className="min-w-0"><dt className="text-[11px] uppercase tracking-wide text-slate-500">Shape</dt><dd className="mt-0.5 truncate font-medium capitalize text-slate-800">{String(table.shape || "square").toLowerCase()}</dd></div>
      </dl>

      <div className="mt-3 flex items-center gap-2">
        <button type="button" onClick={stop(onSelect)} className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 text-sm font-medium text-white hover:bg-slate-800"><FiEye className="h-4 w-4 shrink-0" aria-hidden="true" />Open</button>
        <button type="button" onClick={stop(onEdit)} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50" aria-label={`Edit table ${table.tableNumber}`} title="Edit table"><FiEdit2 className="h-4 w-4" /></button>
        <button type="button" onClick={stop(onDelete)} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700" aria-label={`Delete table ${table.tableNumber}`} title="Delete table"><FiTrash2 className="h-4 w-4" /></button>
      </div>

      {onTableClick && <button type="button" onClick={stop(onTableClick)} className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-brand-200 bg-brand-50 px-3 text-sm font-medium text-brand-700 hover:bg-brand-100">{hasActiveOrder ? "Add Another Order" : "Create New Order"}</button>}
    </article>
  );
};

export default memo(TableCard);
