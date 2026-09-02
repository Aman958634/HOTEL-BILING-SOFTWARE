import { memo } from "react";
import { FiEdit2, FiEye, FiTrash2 } from "react-icons/fi";
import { currency, dateTime } from "../../../utils/format";
import { paymentBadgeClasses, paymentStatusLabel } from "../../../utils/paymentUtils";
import OrderStatusBadge from "./OrderStatusBadge";

const paymentMethodText = (value) => String(value || "CASH").replaceAll("_", " ");

const elapsedTime = (value) => {
  const created = new Date(value).getTime();
  if (!Number.isFinite(created)) return null;
  const minutes = Math.max(0, Math.floor((Date.now() - created) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
};

const OrderCard = ({ order, onOpen, onEdit, onDelete }) => (
  <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
    <div className="flex min-w-0 items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="break-words text-sm font-semibold text-slate-900">#{order.orderNumber}</p>
        <p className="text-xs text-slate-500">{dateTime(order.createdAt)}</p>
      </div>
      <div className="shrink-0"><OrderStatusBadge status={order.status} /></div>
    </div>

    <p className="mt-2 break-words text-sm font-medium text-slate-700">
      {order.table?.tableNumber ? `Table ${order.table.tableNumber}` : order.customer?.fullName || "Guest"}
    </p>
    {order.table?.tableNumber && order.customer?.fullName ? <p className="mt-0.5 break-words text-xs text-slate-500">{order.customer.fullName}</p> : null}

    <dl className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-2.5 text-sm">
      <div className="min-w-0">
        <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Amount</dt>
        <dd className="mt-0.5 break-words font-semibold text-slate-900">{currency(order.total)}</dd>
      </div>
      <div className="min-w-0">
        <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Items</dt>
        <dd className="mt-0.5 font-semibold text-slate-900">{order.items?.length || 0}</dd>
      </div>
    </dl>

    <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
      <span>{String(order.orderType || "").replaceAll("_", " ")}</span>
      <span aria-hidden="true">·</span>
      <span>{paymentMethodText(order.paymentMethod)}</span>
      {order.kitchenStatus ? <><span aria-hidden="true">·</span><span>Kitchen: {String(order.kitchenStatus).replaceAll("_", " ")}</span></> : null}
      {elapsedTime(order.createdAt) ? <><span aria-hidden="true">·</span><span>{elapsedTime(order.createdAt)}</span></> : null}
    </div>
    <p className="mt-2"><span className={`inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-xs font-medium ${paymentBadgeClasses(order.paymentStatus)}`}>{paymentStatusLabel(order.paymentStatus)}</span></p>

    <button type="button" onClick={() => onOpen(order)} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-brand-700 px-3 text-sm font-semibold text-white transition hover:bg-brand-800 focus:outline-none focus:ring-2 focus:ring-brand-500/30" aria-label={`Open order ${order.orderNumber}`}>
      <FiEye className="h-4 w-4 shrink-0" aria-hidden="true" /> Open Order
    </button>
    <div className="mt-2 flex gap-2">
      <button type="button" onClick={() => onEdit(order)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-teal-200 bg-white px-3 text-sm font-medium text-teal-700 transition hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-500/30" aria-label={`Edit order ${order.orderNumber}`}>
        <FiEdit2 className="h-4 w-4 shrink-0" aria-hidden="true" /> Edit
      </button>
      <button type="button" onClick={() => onDelete(order)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-white px-3 text-sm font-medium text-rose-700 transition hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-500/30" aria-label={`Delete order ${order.orderNumber}`}>
        <FiTrash2 className="h-4 w-4 shrink-0" aria-hidden="true" /> Delete
      </button>
    </div>
  </article>
);

export default memo(OrderCard);
