import { useEffect } from "react";
import { currency, dateTime } from "../../../utils/format";
import OrderStatusBadge from "./OrderStatusBadge";
import OrderTimeline from "./OrderTimeline";
import { paymentBadgeClasses, paymentMethodLabel, paymentStatusLabel } from "../../../utils/paymentUtils";
import { formatPaymentId } from "../../../utils/paymentId";

const OrderDetailsDrawer = ({ open, order, onClose, loading, onViewReceipt, onPrintReceipt }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => { if (event.key === "Escape") onClose?.(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 p-0 sm:p-3" role="dialog" aria-modal="true" aria-labelledby="order-details-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <div className="h-full w-full max-w-2xl overflow-y-auto overscroll-contain bg-white p-4 shadow-2xl sm:max-h-[calc(100dvh-1.5rem)] sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id="order-details-title" className="text-xl font-bold text-slate-900">Order Details</h3>
            <p className="text-sm text-slate-500">Detailed order overview and timeline.</p>
          </div>
          <button type="button" onClick={onClose} className="min-h-11 shrink-0 rounded-lg border border-slate-300 px-3 py-1 text-sm">Close</button>
        </div>

        {loading ? (
          <div className="mt-4 h-52 animate-pulse rounded-xl bg-slate-100" />
        ) : order ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="break-words text-sm font-semibold text-slate-900">#{order.orderNumber}</p>
              <div className="mt-2"><OrderStatusBadge status={order.status} /></div>
              <p className="mt-2 text-sm text-slate-600">{dateTime(order.createdAt)}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
                <p><strong>Customer:</strong> {order.customer?.fullName || "Guest"}</p>
                <p><strong>Phone:</strong> {order.customer?.phone || "-"}</p>
                <p><strong>Email:</strong> {order.customer?.email || "-"}</p>
                <p><strong>Table:</strong> {order.table?.tableNumber ? `Table ${order.table.tableNumber}` : "-"}</p>
                <p><strong>Order Type:</strong> {String(order.orderType || "").replaceAll("_", " ")}</p>
                <p><strong>Order Source:</strong> {String(order.orderSource || order.orderType || "").replaceAll("_", " ")}</p>
                {order.deliveryAddress ? <p><strong>Delivery Address:</strong> {order.deliveryAddress}</p> : null}
                {order.pickupDetails ? <p><strong>Pickup Details:</strong> {order.pickupDetails}</p> : null}
              </div>
              <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
                <p><strong>Payment Method:</strong> {paymentMethodLabel(order.paymentMethod)}</p>
                <p><strong>Payment Status:</strong> <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${paymentBadgeClasses(order.paymentStatus)}`}>{paymentStatusLabel(order.paymentStatus)}</span></p>
                <p><strong>Payment ID:</strong> {formatPaymentId(order.paymentId)}</p>
                <p><strong>Transaction ID:</strong> {order.transactionId || "-"}</p>
                <p><strong>Paid At:</strong> {dateTime(order.paidAt || order.updatedAt)}</p>
                <p><strong>Created:</strong> {dateTime(order.createdAt)}</p>
                <p><strong>Updated:</strong> {dateTime(order.updatedAt)}</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-900">Items</p>
              <div className="mt-2 space-y-2">
                {(order.items || []).map((item, idx) => (
                  <div key={idx} className="flex min-w-0 items-start justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="break-words font-medium text-slate-800">{item.name || item.menuItem?.name || "Item"}</p>
                      <p className="text-xs text-slate-500">{currency(item.price)} x {item.quantity}</p>
                    </div>
                    <p className="shrink-0 font-semibold text-slate-900">{currency(item.subtotal || item.price * item.quantity)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-700">
              <div className="flex justify-between"><span>Subtotal</span><span>{currency(order.subtotal)}</span></div>
              <div className="flex justify-between"><span>Discount</span><span>-{currency(order.discount)}</span></div>
              <div className="flex justify-between"><span>Tax</span><span>{currency(order.tax)}</span></div>
              <div className="flex justify-between"><span>Service Charge</span><span>{currency(order.serviceCharge)}</span></div>
              <div className="flex justify-between"><span>Delivery Charge</span><span>{currency(order.deliveryCharge)}</span></div>
              <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 font-semibold text-slate-900"><span>Grand total</span><span>{currency(order.total)}</span></div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <p className="mb-2 text-sm font-semibold text-slate-900">Timeline</p>
              <OrderTimeline history={order.statusHistory || []} />
              {order.rejectionReason ? <p className="mt-3 rounded-lg bg-rose-50 p-2 text-sm text-rose-700"><strong>Rejection reason:</strong> {order.rejectionReason}</p> : null}
            </div>

            {String(order.paymentStatus || "").toUpperCase() === "PAID" ? (
              <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                <button type="button" onClick={() => onViewReceipt?.(order)} className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700">View Receipt</button>
                <button type="button" onClick={() => onPrintReceipt?.(order)} className="min-h-11 rounded-lg border border-teal-200 bg-teal-50 px-4 py-2 text-sm font-medium text-teal-700">Print Receipt</button>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-sm text-rose-600">Unable to load order details.</p>
        )}
      </div>
    </div>
  );
};

export default OrderDetailsDrawer;
