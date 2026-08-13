import { FiEdit2, FiTrash2 } from "react-icons/fi";
import { currency, dateTime } from "../../../utils/format";
import OrderCard from "./OrderCard";
import OrderStatusBadge from "./OrderStatusBadge";

const paymentText = (value) => String(value || "PENDING").replaceAll("_", " ");
const paymentMethodText = (value) => String(value || "CASH").replaceAll("_", " ");

const editBtnClass =
  "inline-flex items-center gap-1 rounded-md border border-teal-200 bg-white px-2 py-1 text-xs font-medium text-teal-700 transition hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-500/30";

const deleteBtnClass =
  "inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-2 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-500/30";

const OrderTable = ({ orders, loading, onEdit, onDelete }) => {
  if (loading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />;
  }

  if (!orders.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center">
        <p className="text-sm text-slate-500">No orders found.</p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Order ID</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Table</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3">Order Type</th>
              <th className="px-4 py-3">Payment Method</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order._id} className="border-b border-slate-100 text-slate-700">
                <td className="px-4 py-3 font-medium">#{order.orderNumber}</td>
                <td className="px-4 py-3">{order.customer?.fullName || "Guest"}</td>
                <td className="px-4 py-3">{order.table?.tableNumber ? `Table ${order.table.tableNumber}` : "-"}</td>
                <td className="px-4 py-3">{order.items?.length || 0} Items</td>
                <td className="px-4 py-3">{String(order.orderType || "").replaceAll("_", " ")}</td>
                <td className="px-4 py-3">{paymentMethodText(order.paymentMethod)}</td>
                <td className="px-4 py-3">{currency(order.total)}</td>
                <td className="px-4 py-3">{paymentText(order.paymentStatus)}</td>
                <td className="px-4 py-3"><OrderStatusBadge status={order.status} /></td>
                <td className="px-4 py-3">{dateTime(order.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => onEdit(order)} className={editBtnClass} aria-label={`Edit order ${order.orderNumber}`}>
                      <FiEdit2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      Edit
                    </button>
                    <button type="button" onClick={() => onDelete(order)} className={deleteBtnClass} aria-label={`Delete order ${order.orderNumber}`}>
                      <FiTrash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 lg:hidden">
        {orders.map((order) => (
          <OrderCard key={order._id} order={order} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>
    </>
  );
};

export default OrderTable;
