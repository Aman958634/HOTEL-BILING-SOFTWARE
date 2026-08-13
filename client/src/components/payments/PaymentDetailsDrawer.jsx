import { FiClock, FiDollarSign, FiFileText, FiPhone, FiTable, FiUser } from "react-icons/fi";
import { canRefundPayment, formatCurrency, formatPaymentDate, paymentBadgeClasses, paymentMethodLabel, paymentStatusLabel } from "../../utils/paymentUtils";

const Section = ({ title, children }) => (
  <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
    <h4 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{title}</h4>
    <div className="mt-3 space-y-2 text-sm text-slate-700">{children}</div>
  </section>
);

const TimelineItem = ({ item, last }) => (
  <div className="flex gap-3">
    <div className="flex flex-col items-center">
      <span className="h-3 w-3 rounded-full bg-brand-700" />
      {!last ? <span className="mt-1 h-full w-px flex-1 bg-slate-200" /> : null}
    </div>
    <div className="pb-4">
      <p className="font-medium text-slate-900">{item.label}</p>
      <p className="text-xs text-slate-500">{formatPaymentDate(item.timestamp)}{item.note ? ` · ${item.note}` : ""}</p>
    </div>
  </div>
);

const PaymentDetailsDrawer = ({ open, payment, onClose, loading, onReceipt, onRefund }) => {
  if (!open) return null;

  const order = payment?.order;
  const timeline = payment?.timeline || [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50">
      <div className="h-full w-full max-w-3xl overflow-y-auto bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Payment Details</h3>
            <p className="text-sm text-slate-500">Comprehensive payment, order and refund information.</p>
          </div>
          <button onClick={onClose} className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700">Close</button>
        </div>

        {loading ? (
          <div className="mt-4 h-72 animate-pulse rounded-2xl bg-slate-100" />
        ) : payment ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">Payment ID</p>
                  <p className="text-2xl font-bold text-slate-900">{payment.paymentId}</p>
                  <p className="mt-1 text-sm text-slate-500">Order #{order?.orderNumber || payment.orderIdValue}</p>
                </div>
                <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${paymentBadgeClasses(payment.paymentStatus)}`}>
                  {paymentStatusLabel(payment.paymentStatus)}
                </span>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Section title="Payment Information">
                <p><strong>Payment ID:</strong> {payment.paymentId}</p>
                <p><strong>Transaction ID:</strong> {payment.transactionId || "-"}</p>
                <p><strong>Order ID:</strong> {order?.orderNumber || payment.orderIdValue}</p>
                <p><strong>Payment Date:</strong> {formatPaymentDate(payment.createdAt)}</p>
                <p><strong>Payment Status:</strong> {paymentStatusLabel(payment.paymentStatus)}</p>
                <p><strong>Payment Method:</strong> {paymentMethodLabel(payment.paymentMethod)}</p>
                <p><strong>Gateway:</strong> {payment.gatewayLabel || payment.gateway || payment.metadata?.gateway || payment.metadata?.provider || "-"}</p>
                <p><strong>Amount:</strong> {formatCurrency(payment.totalAmount)}</p>
              </Section>

              <Section title="Customer Information">
                <p className="flex items-center gap-2"><FiUser /> {order?.customer?.fullName || payment.customer?.fullName || payment.customerName || "Guest"}</p>
                <p className="flex items-center gap-2"><FiPhone /> {order?.customer?.phone || payment.customer?.phone || payment.customerPhone || "-"}</p>
                <p><strong>Email:</strong> {order?.customer?.email || payment.customer?.email || "-"}</p>
                <p className="flex items-center gap-2"><FiTable /> {order?.table?.tableNumber ? `Table ${order.table.tableNumber}` : payment.table?.tableNumber ? `Table ${payment.table.tableNumber}` : "-"}</p>
              </Section>
            </div>

            <Section title="Order Information">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <p><strong>Subtotal:</strong> {formatCurrency(order?.subtotal ?? payment.subtotal)}</p>
                <p><strong>Discount:</strong> {formatCurrency(order?.discount ?? payment.discount)}</p>
                <p><strong>Tax / GST:</strong> {formatCurrency(order?.tax ?? payment.tax)}</p>
                <p><strong>Service Charge:</strong> {formatCurrency(order?.serviceCharge ?? payment.serviceCharge)}</p>
                <p><strong>Grand Total:</strong> {formatCurrency(order?.total ?? payment.totalAmount)}</p>
                <p><strong>Refunded:</strong> {formatCurrency(payment.refundAmount || 0)}</p>
              </div>

              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                <p className="mb-2 text-sm font-semibold text-slate-900">Ordered Items</p>
                {(order?.items || []).length ? (
                  <div className="space-y-2">
                    {(order.items || []).map((item, index) => (
                      <div key={index} className="flex items-center justify-between gap-3 text-sm">
                        <div>
                          <p className="font-medium text-slate-800">{item.menuItem?.name || item.name || "Item"}</p>
                          <p className="text-xs text-slate-500">Qty {item.quantity} · {formatCurrency(item.price)}</p>
                        </div>
                        <p className="font-semibold text-slate-900">{formatCurrency(item.subtotal ?? item.price * item.quantity)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No order items available.</p>
                )}
              </div>
            </Section>

            <Section title="Payment Timeline">
              <div className="space-y-0">
                {(timeline || []).length ? (
                  (timeline || []).map((item, index) => (
                    <TimelineItem
                      key={`${item.status}-${index}`}
                      item={{ label: item.status.replaceAll("_", " "), timestamp: item.timestamp, note: item.note }}
                      last={index === timeline.length - 1}
                    />
                  ))
                ) : (
                  <p className="text-sm text-slate-500">Timeline not available.</p>
                )}
              </div>
            </Section>

            <div className="flex flex-wrap justify-end gap-2">
              <button onClick={() => onReceipt(payment)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700">
                <FiFileText className="inline-block -translate-y-px" /> View Receipt
              </button>
              {canRefundPayment(payment) ? (
                <button onClick={() => onRefund(payment)} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-medium text-rose-700">
                  Refund
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-rose-600">Unable to load payment details.</p>
        )}
      </div>
    </div>
  );
};

export default PaymentDetailsDrawer;
