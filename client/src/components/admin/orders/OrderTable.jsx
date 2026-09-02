import { memo } from "react";
import { FiEdit2, FiEye, FiShoppingBag, FiTrash2 } from "react-icons/fi";
import { currency, dateTime } from "../../../utils/format";
import { paymentMethodLabel } from "../../../utils/paymentUtils";
import OrderCard from "./OrderCard";
import OrderStatusBadge from "./OrderStatusBadge";
import EmptyState from "../../common/EmptyState";
import { SkeletonTable } from "../../common/Skeletons";

const paymentText = (value) => String(value || "PENDING").replaceAll("_", " ");
const editBtnClass =
  "inline-flex shrink-0 items-center gap-1 rounded-md border border-teal-200 bg-white px-2 py-1 text-xs font-medium text-teal-700 transition hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-500/30";

const deleteBtnClass =
  "inline-flex shrink-0 items-center gap-1 rounded-md border border-rose-200 bg-white px-2 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-500/30";

const cellClass = "px-4 py-3 align-middle whitespace-nowrap";

const openBtnClass =
  "inline-flex shrink-0 items-center gap-1 rounded-md bg-brand-700 px-2 py-1 text-xs font-semibold text-white transition hover:bg-brand-800 focus:outline-none focus:ring-2 focus:ring-brand-500/30";

const OrderRow = memo(({ order, onOpen, onEdit, onDelete }) => (
  <tr className="border-b border-slate-100 text-slate-700">
    <td className={`${cellClass} font-medium`}>#{order.orderNumber}</td>
    <td className={cellClass}>{order.customer?.fullName || "Guest"}</td>
    <td className={cellClass}>{order.table?.tableNumber ? `Table ${order.table.tableNumber}` : "-"}</td>
    <td className={cellClass}>{order.items?.length || 0} Items</td>
    <td className={`${cellClass} font-semibold text-slate-900`}>{currency(order.total)}</td>
    <td className={cellClass}><OrderStatusBadge status={order.status} /></td>
    <td className={cellClass}>{order.kitchenStatus ? String(order.kitchenStatus).replaceAll("_", " ") : "-"}</td>
    <td className={cellClass}>{paymentText(order.paymentStatus)} · {paymentMethodLabel(order.paymentMethod)}</td>
    <td className={cellClass}>{dateTime(order.createdAt)}</td>
    <td className={cellClass}>
      <div className="flex flex-nowrap gap-2">
        <button type="button" onClick={() => onOpen(order)} className={openBtnClass} aria-label={`Open order ${order.orderNumber}`}>
          <FiEye className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Open
        </button>
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

const OrderTable = ({ orders, loading, error, onOpen, onEdit, onDelete, hasFilters = false }) => {
  if (loading) {
    return (
      <>
        <div className="hidden lg:block"><SkeletonTable rows={6} columns={6} /></div>
        <div className="grid gap-3 lg:hidden" aria-busy="true" aria-label="Loading orders">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex items-start justify-between gap-3"><div className="space-y-2"><div className="h-4 w-32 rounded bg-slate-200" /><div className="h-3 w-24 rounded bg-slate-100" /></div><div className="h-6 w-20 rounded-full bg-slate-100" /></div>
              <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-2.5"><div className="h-9 rounded bg-slate-100" /><div className="h-9 rounded bg-slate-100" /></div>
              <div className="mt-3 h-11 rounded-xl bg-slate-100" />
            </div>
          ))}
        </div>
      </>
    );
  }

  if (error) return null;

  if (!orders.length) {
    return <EmptyState icon={<FiShoppingBag className="h-8 w-8" />} title={hasFilters ? "No matching orders" : "No orders yet"} description={hasFilters ? "Try changing your search or filters." : "Create your first order to start managing restaurant service."} />;
  }

  return (
    <>
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
        <table className="min-w-[1080px] w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className={`${cellClass} min-w-[100px]`}>Order ID</th>
              <th className={`${cellClass} min-w-[120px]`}>Customer</th>
              <th className={`${cellClass} min-w-[80px]`}>Table</th>
              <th className={`${cellClass} min-w-[70px]`}>Items</th>
              <th className={`${cellClass} min-w-[90px]`}>Amount</th>
              <th className={`${cellClass} min-w-[110px]`}>Status</th>
              <th className={`${cellClass} min-w-[100px]`}>Kitchen</th>
              <th className={`${cellClass} min-w-[140px]`}>Payment</th>
              <th className={`${cellClass} min-w-[140px]`}>Created</th>
              <th className={`${cellClass} min-w-[210px]`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => <OrderRow key={order._id} order={order} onOpen={onOpen} onEdit={onEdit} onDelete={onDelete} />)}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 lg:hidden">
        {orders.map((order) => (
          <OrderCard key={order._id} order={order} onOpen={onOpen} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>
    </>
  );
};

export default memo(OrderTable);
