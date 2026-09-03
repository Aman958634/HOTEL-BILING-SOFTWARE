import { useEffect } from "react";
import { currency } from "../../../utils/format";
import Button from "../../ui/Button";

const paymentLabel = (value) => String(value || "CASH").replaceAll("_", " ");

const OrderPaymentPromptModal = ({ open, order, onClose, onPayNow, onPayLater, onViewOrder, loading }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => { if (event.key === "Escape" && !loading) onClose?.(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [loading, onClose, open]);

  if (!open || !order) return null;

  const items = Array.isArray(order.items) ? order.items : [];
  const subtotal = Number(order.subtotal || 0);
  const discount = Number(order.discount || 0);
  const tax = Number(order.tax || 0);
  const serviceCharge = Number(order.serviceCharge || 0);
  const deliveryCharge = Number(order.deliveryCharge || 0);
  const total = Number(order.total || 0);
  const customerName = order.customer?.fullName || "Guest";

  return (
    <div className="ui-modal-backdrop" role="presentation" onMouseDown={(event) => { if (!loading && event.target === event.currentTarget) onClose?.(); }}>
      <div className="ui-modal max-w-xl" role="dialog" aria-modal="true" aria-labelledby="order-payment-title" aria-describedby="order-payment-description">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium uppercase tracking-wide text-emerald-600">Pay Order</p>
            <h3 id="order-payment-title" className="mt-1 break-words text-xl font-bold text-slate-900 sm:text-2xl">{`Order ID: #${order.orderNumber}`}</h3>
            <p id="order-payment-description" className="mt-1 break-words text-sm text-slate-500">Customer: {customerName}</p>
          </div>
          <button type="button" onClick={onClose} className="min-h-11 shrink-0 rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700">Close</button>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="font-semibold text-slate-900">Items</p>
              <div className="mt-2 space-y-2">
                {items.map((item, index) => (
                  <div key={index} className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-medium text-slate-800">{item.name || item.menuItem?.name || "Item"}</p>
                      <p className="text-xs text-slate-500">{item.quantity} x {currency(item.price)}</p>
                    </div>
                    <p className="shrink-0 font-semibold text-slate-900">{currency(item.subtotal ?? Number(item.price || 0) * Number(item.quantity || 0))}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <p><strong>Payment Method:</strong> {paymentLabel(order.paymentMethod)}</p>
              <p><strong>Payment Status:</strong> {String(order.paymentStatus || "").replaceAll("_", " ")}</p>
              <p><strong>Order Status:</strong> {String(order.status || "").replaceAll("_", " ")}</p>
              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>{currency(subtotal)}</span></div>
                <div className="flex justify-between"><span>Discount</span><span>-{currency(discount)}</span></div>
                <div className="flex justify-between"><span>Tax</span><span>{currency(tax)}</span></div>
                <div className="flex justify-between"><span>Service Charge</span><span>{currency(serviceCharge)}</span></div>
                {deliveryCharge ? <div className="flex justify-between"><span>Delivery Charge</span><span>{currency(deliveryCharge)}</span></div> : null}
                <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 font-semibold text-slate-900"><span>Grand Total</span><span>{currency(total)}</span></div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:justify-end sm:gap-3">
          <Button variant="secondary" onClick={onPayLater} disabled={loading}>Pay Later</Button>
          <Button variant="secondary" onClick={onViewOrder} disabled={loading}>View Order</Button>
          <Button onClick={onPayNow} loading={loading} loadingText="Processing…" className="bg-teal-700 hover:bg-teal-800">{`Pay ${currency(total)}`}</Button>
        </div>
      </div>
    </div>
  );
};

export default OrderPaymentPromptModal;
