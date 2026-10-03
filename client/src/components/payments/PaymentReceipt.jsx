import { FiCheck, FiDownload, FiPrinter, FiX } from "react-icons/fi";
import { formatCurrency, formatPaymentDate, getPaymentAmount, paymentMethodLabel } from "../../utils/paymentUtils";
import { formatPaymentId } from "../../utils/paymentId";

const valueOr = (value, fallback = "-") => value ?? fallback;

const PaymentReceipt = ({ open, payment, onClose, onDownload, onPrint }) => {
  if (!open || !payment) return null;

  const order = payment?.order || {};
  const items = Array.isArray(order.items) ? order.items : [];
  const paymentDate = payment?.paidAt || payment?.createdAt;
  const subtotal = valueOr(order.subtotal, payment?.subtotal);
  const discount = valueOr(order.discount, payment?.discount);
  const tax = valueOr(order.tax, payment?.tax);
  const serviceCharge = order.serviceCharge ?? payment?.serviceCharge;
  const total = getPaymentAmount(payment) || valueOr(order.total, 0);
  const transactionReference = payment?.transactionId || payment?.razorpayPaymentId || payment?.cashfreePaymentId || "-";
  const restaurant = payment?.restaurant || {};
  const restaurantName = restaurant?.name || payment?.restaurantName || "RestoSphere";
  const tableName = order.table?.tableNumber ? "Table " + order.table.tableNumber : payment.tableNumber ? "Table " + payment.tableNumber : "-";
  const contactAndTable = (order.customer?.phone || payment.customerPhone || "-") + " / " + tableName;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/50 p-0 sm:p-4 print:static print:bg-white">
      <div className="ml-auto flex h-full w-full max-w-3xl flex-col bg-slate-50 shadow-2xl print:max-w-none print:shadow-none">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white p-4 print:hidden">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Receipt Preview</h3>
            <p className="text-sm text-slate-500">A receipt is available for this verified payment.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 p-2 text-slate-600 hover:bg-slate-50" aria-label="Close receipt preview">
            <FiX />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 sm:p-6 print:overflow-visible print:p-0">
          <article id="payment-receipt-print" className="payment-receipt mx-auto max-w-2xl overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 print:max-w-none print:rounded-none print:shadow-none print:ring-0">
            <header className="payment-receipt-header border-b border-slate-200 px-5 py-7 text-center sm:px-10">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 text-2xl text-white shadow-sm"><FiCheck aria-hidden="true" /></span>
              <h1 className="mt-3 text-2xl font-extrabold text-emerald-800">Payment Successful!</h1>
              <p className="mt-1 text-sm text-slate-500">Thank you! Your payment has been completed.</p>
              <img src="/restosphere-logo.png" alt="RestoSphere" className="mx-auto mt-6 h-10 w-auto object-contain" />
              <p className="mt-1 text-sm font-medium text-slate-700">{restaurantName}</p>
              {restaurant.address ? <p className="mt-1 text-xs text-slate-500">{restaurant.address}</p> : null}
              {restaurant.phone || restaurant.gstNumber ? <p className="mt-1 text-xs text-slate-500">{[restaurant.phone, restaurant.gstNumber ? `GSTIN: ${restaurant.gstNumber}` : ""].filter(Boolean).join(" · ")}</p> : null}
              <div className="mt-5 border-t border-slate-200 pt-4"><h2 className="text-sm font-extrabold tracking-[0.18em] text-slate-900">PAYMENT RECEIPT</h2></div>
            </header>

            <section className="payment-receipt-details grid gap-5 border-b border-slate-200 px-5 py-5 text-sm sm:grid-cols-2 sm:px-10">
              <div className="space-y-3">
                <ReceiptField label="Receipt No." value={formatPaymentId(payment.paymentIdDisplay || payment.paymentId)} />
                <ReceiptField label="Order No." value={order.orderNumber || payment.orderIdValue} />
                <ReceiptField label="Payment Date" value={formatPaymentDate(paymentDate)} />
              </div>
              <div className="space-y-3">
                <ReceiptField label="Restaurant" value={restaurantName} />
                <ReceiptField label="Customer" value={order.customer?.fullName || payment.customerName || "Guest"} />
                <ReceiptField label="Phone / Table" value={contactAndTable} />
              </div>
            </section>

            <section className="payment-receipt-items px-5 py-5 sm:px-10">
              <div className="overflow-x-auto">
                <table className="payment-receipt-items-table w-full text-left text-sm">
                  <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                    <tr><th className="rounded-l-lg px-3 py-3 font-semibold">#</th><th className="px-3 py-3 font-semibold">Item</th><th className="px-3 py-3 text-right font-semibold">Qty</th><th className="px-3 py-3 text-right font-semibold">Price</th><th className="rounded-r-lg px-3 py-3 text-right font-semibold">Total</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.length ? items.map((item, index) => (
                      <tr key={(item._id || item.name || "item") + "-" + index} className="align-top">
                        <td className="px-3 py-3 text-slate-500">{index + 1}</td>
                        <td className="max-w-[240px] break-words px-3 py-3 font-medium text-slate-800">{item.menuItem?.name || item.name || "Item"}</td>
                        <td className="px-3 py-3 text-right text-slate-700">{item.quantity}</td>
                        <td className="px-3 py-3 text-right text-slate-700">{formatCurrency(item.price)}</td>
                        <td className="px-3 py-3 text-right font-semibold text-slate-900">{formatCurrency(item.subtotal ?? item.price * item.quantity)}</td>
                      </tr>
                    )) : <tr><td colSpan="5" className="px-3 py-5 text-center text-slate-500">No item details were recorded for this payment.</td></tr>}
                  </tbody>
                </table>
              </div>

              <div className="payment-receipt-totals ml-auto mt-5 w-full max-w-xs space-y-2 text-sm">
                <AmountRow label="Subtotal" value={subtotal} />
                <AmountRow label="Discount" value={discount} negative={Number(discount) > 0} />
                <AmountRow label="Tax / GST" value={tax} />
                {serviceCharge !== undefined && serviceCharge !== null ? <AmountRow label="Service Charge" value={serviceCharge} /> : null}
                <div className="payment-receipt-grand-total mt-2 flex justify-between rounded-lg bg-emerald-50 px-3 py-3 text-base font-extrabold text-emerald-800"><span>Grand Total</span><span>{formatCurrency(total)}</span></div>
              </div>
            </section>

            <section className="payment-receipt-payment border-t border-slate-200 px-5 py-5 text-sm sm:px-10">
              <dl className="payment-receipt-payment-details grid gap-2 sm:grid-cols-[155px_1fr]">
                <ReceiptPaymentField label="Payment Method" value={paymentMethodLabel(payment.paymentMethod, payment.provider)} />
                <ReceiptPaymentField label="Payment ID" value={formatPaymentId(payment.paymentIdDisplay || payment.paymentId)} />
                <ReceiptPaymentField label="Transaction / Reference" value={transactionReference} />
                <ReceiptPaymentField label="Status" value="SUCCESS" success />
              </dl>
            </section>

            <footer className="payment-receipt-footer border-t border-slate-200 px-5 py-6 text-center sm:px-10">
              <p className="font-bold text-brand-700">Thank you for choosing RestoSphere!</p>
              <p className="mt-1 text-xs text-slate-400">This is a computer-generated receipt.</p>
            </footer>
          </article>

          <div className="mx-auto mt-4 flex max-w-2xl flex-wrap justify-end gap-2 print:hidden">
            <button type="button" onClick={onPrint} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><FiPrinter /> Print Receipt</button>
            <button type="button" onClick={onDownload} className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"><FiDownload /> Download PDF</button>
            <button type="button" onClick={onClose} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Close</button>
          </div>
        </div>
      </div>
    </div>
  );
};

const ReceiptField = ({ label, value }) => <div className="payment-receipt-field"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="payment-receipt-value mt-1 break-words font-semibold text-slate-800">{value || "-"}</p></div>;
const ReceiptPaymentField = ({ label, value, success = false }) => <div className="payment-receipt-payment-row"><dt className="text-slate-500">{label}</dt><dd className={`payment-receipt-payment-value text-right font-semibold ${success ? "text-emerald-700" : "text-slate-900"}`}>{value || "-"}</dd></div>;
const AmountRow = ({ label, value, negative = false }) => <div className="flex justify-between text-slate-600"><span>{label}</span><span>{negative ? "-" : ""}{formatCurrency(value)}</span></div>;

export default PaymentReceipt;
