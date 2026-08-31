import { memo } from "react";
import { FiEdit2, FiShoppingBag, FiTrash2 } from "react-icons/fi";
import { currency, dateTime } from "../../../utils/format";
import { paymentMethodLabel } from "../../../utils/paymentUtils";
import OrderCard from "./OrderCard";
import OrderStatusBadge from "./OrderStatusBadge";
import EmptyState from "../../common/EmptyState";
import { SkeletonTable } from "../../common/Skeletons";

const paymentText = (value) => String(value || "PENDING").replaceAll("_", " ");
const orderTypeText = (value) => String(value || "").replaceAll("_", " ");

const editBtnClass =
  "inline-flex shrink-0 items-center gap-1 rounded-md border border-teal-200 bg-white px-2 py-1 text-xs font-medium text-teal-700 transition hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-500/30";

const deleteBtnClass =
  "inline-flex shrink-0 items-center gap-1 rounded-md border border-rose-200 bg-white px-2 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-500/30";

const cellClass = "px-4 py-3 align-middle whitespace-nowrap";

const OrderRow = memo(({ order, onEdit, onDelete }) => (
  <tr className="border-b border-slate-100 text-slate-700">
    <td className={`${cellClass} font-medium`}>#{order.orderNumber}</td>
    <td className={cellClass}>{order.customer?.fullName || "Guest"}</td>
    <td className={cellClass}>{order.table?.tableNumber ? `Table ${order.table.tableNumber}` : "-"}</td>
    <td className={cellClass}>{order.items?.length || 0} Items</td>
    <td className={cellClass}>{orderTypeText(order.orderType)}</td>
    <td className={cellClass}>{paymentMethodLabel(order.paymentMethod)}</td>
    <td className={cellClass}>{currency(order.total)}</td>
    <td className={cellClass}>{paymentText(order.paymentStatus)}</td>
    <td className={cellClass}><OrderStatusBadge status={order.status} /></td>
    <td className={cellClass}>{dateTime(order.createdAt)}</td>
    <td className={cellClass}>
      <div className="flex flex-nowrap gap-2">
        <button type="button" onClick={() => onEdit(order)} className={editBtnClass} aria-label={`Edit order ${order.orderNumber}`}>
          <FiEdit2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Edit
        </button>
        <button type="button" onClick={() => onDelete(order)} className={deleteBtnClass} aria-label={`Delete order ${order.orderNumber}`}>
          <FiTrash2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Delete
        </button>
      </div>
    </td>
  </tr>
));

const OrderTable = ({ orders, loading, error, onEdit, onDelete, hasFilters = false }) => {
  if (loading) {
    return <SkeletonTable rows={6} columns={6} />;
  }

  if (error) return null;

  if (!orders.length) {
    return <EmptyState icon={<FiShoppingBag className="h-8 w-8" />} title={hasFilters ? "No matching orders" : "No orders yet"} description={hasFilters ? "Try changing your search or filters." : "Create your first order to start managing restaurant service."} />;
  }

  return (
    <>
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
        <table className="min-w-[1100px] w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className={`${cellClass} min-w-[100px]`}>Order ID</th>
              <th className={`${cellClass} min-w-[120px]`}>Customer</th>
              <th className={`${cellClass} min-w-[80px]`}>Table</th>
              <th className={`${cellClass} min-w-[70px]`}>Items</th>
              <th className={`${cellClass} min-w-[100px]`}>Order Type</th>
              <th className={`${cellClass} min-w-[110px]`}>Payment Method</th>
              <th className={`${cellClass} min-w-[90px]`}>Amount</th>
              <th className={`${cellClass} min-w-[90px]`}>Payment</th>
              <th className={`${cellClass} min-w-[110px]`}>Status</th>
              <th className={`${cellClass} min-w-[140px]`}>Created</th>
              <th className={`${cellClass} min-w-[150px]`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => <OrderRow key={order._id} order={order} onEdit={onEdit} onDelete={onDelete} />)}
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

export default memo(OrderTable);
