import { currency } from "../../../utils/format";

const paymentLabel = (value) => String(value || "CASH").replaceAll("_", " ");

const OrderPaymentPromptModal = ({ open, order, onClose, onPayNow, onPayLater, onViewOrder, loading }) => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-emerald-600">Pay Order</p>
            <h3 className="mt-1 text-2xl font-bold text-slate-900">{`Order ID: #${order.orderNumber}`}</h3>
            <p className="mt-1 text-sm text-slate-500">Customer: {customerName}</p>
          </div>
          <button onClick={onClose} className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700">Close</button>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="font-semibold text-slate-900">Items</p>
              <div className="mt-2 space-y-2">
                {items.map((item, index) => (
                  <div key={index} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-800">{item.name || item.menuItem?.name || "Item"}</p>
                      <p className="text-xs text-slate-500">{item.quantity} x {currency(item.price)}</p>
                    </div>
                    <p className="font-semibold text-slate-900">{currency(item.subtotal ?? Number(item.price || 0) * Number(item.quantity || 0))}</p>
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

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button onClick={onPayLater} className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700">Pay Later</button>
          <button onClick={onViewOrder} className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700">View Order</button>
          <button onClick={onPayNow} disabled={loading} className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-70">
            {loading ? "Processing Payment..." : `Pay ${currency(total)}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrderPaymentPromptModal;
