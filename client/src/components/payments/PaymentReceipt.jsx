import { FiDownload, FiPrinter, FiX } from "react-icons/fi";
import { formatCurrency, formatPaymentDate, getPaymentAmount, paymentMethodLabel, paymentStatusLabel } from "../../utils/paymentUtils";
import { formatPaymentId } from "../../utils/paymentId";

const PaymentReceipt = ({ open, payment, onClose, onDownload, onPrint }) => {
  if (!open) return null;

  const order = payment?.order || {};

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/50">
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-slate-50 p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Receipt Preview</h3>
            <p className="text-sm text-slate-500">Printable receipt for the selected payment.</p>
          </div>
          <button onClick={onClose} className="rounded-xl border border-slate-300 p-2 text-slate-600">
            <FiX />
          </button>
        </div>

        {payment ? (
          <div className="mt-4 rounded-3xl bg-white p-6 shadow-sm print:shadow-none">
            <div className="border-b border-dashed border-slate-300 pb-4 text-center">
              <p className="text-2xl font-black tracking-wide text-brand-700">RestoSphere</p>
              <p className="mt-1 text-sm text-slate-500">Restaurant Management System</p>
              <p className="text-xs text-slate-400">Professional Receipt</p>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 text-sm text-slate-700">
              <div>
                <p><strong>Payment ID:</strong> {formatPaymentId(payment.paymentIdDisplay || payment.paymentId)}</p>
                <p><strong>Order ID:</strong> {order.orderNumber || payment.orderIdValue}</p>
                <p><strong>Transaction ID:</strong> {payment.transactionId || "-"}</p>
                <p><strong>Date & Time:</strong> {formatPaymentDate(payment.createdAt)}</p>
              </div>
              <div>
                <p><strong>Customer:</strong> {order.customer?.fullName || payment.customerName || "Guest"}</p>
                <p><strong>Phone:</strong> {order.customer?.phone || payment.customerPhone || "-"}</p>
                <p><strong>Table:</strong> {order.table?.tableNumber ? `Table ${order.table.tableNumber}` : payment.tableNumber ? `Table ${payment.tableNumber}` : "-"}</p>
                <p><strong>Status:</strong> {paymentStatusLabel(payment.paymentStatus)}</p>
                <p><strong>Gateway:</strong> {payment.gatewayLabel || payment.gateway || payment.metadata?.gateway || payment.metadata?.provider || "-"}</p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 p-4">
              <p className="mb-3 text-sm font-semibold text-slate-900">Items</p>
              <div className="space-y-2 text-sm">
                {(order.items || []).map((item, index) => (
                  <div key={index} className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-800">{item.menuItem?.name || item.name || "Item"}</p>
                      <p className="text-xs text-slate-500">Qty {item.quantity} · {formatCurrency(item.price)}</p>
                    </div>
                    <p className="font-semibold text-slate-900">{formatCurrency(item.subtotal ?? item.price * item.quantity)}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 p-4 text-sm text-slate-700">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(order.subtotal ?? payment.subtotal)}</span></div>
              <div className="flex justify-between"><span>Discount</span><span>-{formatCurrency(order.discount ?? payment.discount)}</span></div>
              <div className="flex justify-between"><span>Tax / GST</span><span>{formatCurrency(order.tax ?? payment.tax)}</span></div>
              <div className="flex justify-between"><span>Service Charge</span><span>{formatCurrency(order.serviceCharge ?? payment.serviceCharge)}</span></div>
              <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold text-slate-900"><span>Grand Total</span><span>{formatCurrency(getPaymentAmount(payment) || order.total)}</span></div>
              <div className="mt-2 flex justify-between"><span>Payment Method</span><span>{paymentMethodLabel(payment.paymentMethod)}</span></div>
              <div className="flex justify-between"><span>Refund Amount</span><span>{formatCurrency(payment.refundAmount || 0)}</span></div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2 print:hidden">
              <button onClick={onPrint} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700">
                <FiPrinter /> Print
              </button>
              <button onClick={onDownload} className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-sm font-medium text-white">
                <FiDownload /> Download PDF
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            Receipt data unavailable.
          </div>
        )}
      </div>
    </div>
  );
};

export default PaymentReceipt;
