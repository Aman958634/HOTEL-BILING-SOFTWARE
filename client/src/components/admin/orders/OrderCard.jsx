import { memo } from "react";
import { FiEdit2, FiTrash2 } from "react-icons/fi";
import { currency, dateTime } from "../../../utils/format";
import OrderStatusBadge from "./OrderStatusBadge";

const paymentText = (value) => String(value || "PENDING").replaceAll("_", " ");
const paymentMethodText = (value) => String(value || "CASH").replaceAll("_", " ");

const OrderCard = ({ order, onEdit, onDelete }) => (
  <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-2">
      <div>
        <p className="text-sm font-semibold text-slate-900">#{order.orderNumber}</p>
        <p className="text-xs text-slate-500">{dateTime(order.createdAt)}</p>
      </div>
      <OrderStatusBadge status={order.status} />
    </div>

    <div className="mt-3 space-y-1 text-sm text-slate-700">
      <p><strong>Customer:</strong> {order.customer?.fullName || "Guest"}</p>
      <p><strong>Table:</strong> {order.table?.tableNumber ? `Table ${order.table.tableNumber}` : "-"}</p>
      <p><strong>Items:</strong> {order.items?.length || 0}</p>
      <p><strong>Order Type:</strong> {String(order.orderType || "").replaceAll("_", " ")}</p>
      <p><strong>Payment Method:</strong> {paymentMethodText(order.paymentMethod)}</p>
      <p><strong>Amount:</strong> {currency(order.total)}</p>
      <p><strong>Payment:</strong> {paymentText(order.paymentStatus)}</p>
    </div>

    <div className="mt-4 flex gap-2">
      <button
        type="button"
        onClick={() => onEdit(order)}
        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-teal-200 bg-white px-3 py-1.5 text-sm font-medium text-teal-700 transition hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
        aria-label={`Edit order ${order.orderNumber}`}
      >
        <FiEdit2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        Edit
      </button>
      <button
        type="button"
        onClick={() => onDelete(order)}
        className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-sm font-medium text-rose-700 transition hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
        aria-label={`Delete order ${order.orderNumber}`}
      >
        <FiTrash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        Delete
      </button>
    </div>
  </article>
);

export default memo(OrderCard);
