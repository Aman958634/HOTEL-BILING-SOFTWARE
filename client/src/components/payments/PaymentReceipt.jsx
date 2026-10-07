import { memo } from "react";
import { createPortal } from "react-dom";
import { FiCheck, FiDownload, FiPrinter, FiX } from "react-icons/fi";
import { formatCurrency, formatPaymentDate, getPaymentAmount } from "../../utils/paymentUtils";

const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null);

const tableOrType = (order = {}, payment = {}) => {
  const tableNumber = order.table?.tableNumber || payment.table?.tableNumber || payment.tableNumber;
  if (tableNumber) return `Table ${tableNumber}`;
  const orderType = String(order.orderType || payment.orderType || "").toUpperCase();
  if (orderType === "TAKEAWAY" || orderType === "PICKUP") return "PARCEL";
  if (orderType === "DELIVERY") return "DELIVERY";
  return "-";
};

const PaymentReceipt = ({ open, payment, downloading = false, onClose, onDownload, onPrint }) => {
  if (!open || !payment) return null;

  const order = payment.order || {};
  const items = Array.isArray(order.items) ? order.items : [];
  const subtotal = firstDefined(order.subtotal, payment.subtotal, 0);
  const discount = firstDefined(order.discount, payment.discount, 0);
  const tax = firstDefined(order.tax, payment.tax, 0);
  const serviceCharge = firstDefined(order.serviceCharge, payment.serviceCharge, 0);
  const total = getPaymentAmount(payment) || firstDefined(order.total, 0);
  const gstRate = Number(firstDefined(order.gstRate, payment.gstRate, 0) || 0);
  const restaurant = payment.restaurant || {};
  const restaurantName = restaurant.name || payment.restaurantName || "RestoSphere";

  return createPortal(
    <div className="payment-receipt-modal fixed inset-0 z-50 bg-slate-950/50 p-3 sm:p-4 print:static print:bg-white">
      <div className="payment-receipt-dialog mx-auto flex h-full w-full max-w-3xl flex-col bg-slate-50 shadow-2xl print:max-w-none print:shadow-none">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white p-4 print:hidden">
          <div><h3 className="text-xl font-bold text-slate-900">Receipt Preview</h3><p className="text-sm text-slate-500">A compact customer receipt for this verified payment.</p></div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 p-2 text-slate-600 hover:bg-slate-50" aria-label="Close receipt preview"><FiX /></button>
        </div>
        <div className="payment-receipt-scroll flex-1 overflow-y-auto p-3 sm:p-5 print:overflow-visible print:p-0">
          <article id="payment-receipt-print" className="payment-receipt mx-auto overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 print:max-w-none print:rounded-none print:shadow-none print:ring-0">
            <header className="payment-receipt-header border-b border-slate-200 px-4 py-5 text-center">
              <img src="/restosphere-logo.png" alt="RestoSphere" className="mx-auto h-9 w-auto object-contain" />
              <p className="mt-2 text-base font-extrabold tracking-wide text-brand-700">RestoSphere</p>
              <p className="mt-0.5 break-words text-xs font-bold uppercase tracking-[0.12em] text-slate-700">{restaurantName}</p>
              <div className="payment-receipt-success mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-800"><FiCheck aria-hidden="true" className="text-base" /> Payment Successful</div>
            </header>
            <section className="payment-receipt-details space-y-2 border-b border-slate-200 px-4 py-4 text-sm">
              <ReceiptField label="Order No" value={order.orderNumber || payment.orderIdValue} />
              <ReceiptField label="Date & Time" value={formatPaymentDate(payment.paidAt || payment.createdAt)} />
              <ReceiptField label="Table / Type" value={tableOrType(order, payment)} />
            </section>
            <section className="payment-receipt-items border-b border-slate-200 px-4 py-4">
              <table className="payment-receipt-items-table w-full table-fixed text-left text-sm">
                <thead className="border-y border-slate-200 text-[11px] uppercase tracking-wide text-slate-600"><tr><th className="w-[57%] py-2 font-semibold">Item</th><th className="w-[13%] py-2 text-right font-semibold">Qty</th><th className="w-[30%] py-2 text-right font-semibold">Amount</th></tr></thead>
                <tbody className="divide-y divide-slate-100">{items.length ? items.map((item, index) => <tr key={(item._id || item.name || "item") + "-" + index} className="align-top"><td className="break-words py-2 pr-2 font-medium text-slate-800">{item.menuItem?.name || item.name || "Item"}</td><td className="py-2 text-right text-slate-700">{item.quantity}</td><td className="py-2 text-right font-semibold text-slate-900">{formatCurrency(item.subtotal ?? item.price * item.quantity)}</td></tr>) : <tr><td colSpan="3" className="py-4 text-center text-xs text-slate-500">No item details were recorded for this payment.</td></tr>}</tbody>
              </table>
              <div className="payment-receipt-totals mt-4 space-y-1.5 text-sm"><AmountRow label="Subtotal" value={subtotal} /><AmountRow label="Discount" value={discount} /><AmountRow label={`GST (${gstRate}%)`} value={tax} /><AmountRow label="Service Charge" value={serviceCharge} /><div className="payment-receipt-grand-total mt-3 flex justify-between rounded-lg bg-emerald-50 px-3 py-3 text-base font-extrabold text-emerald-800"><span>Grand Total</span><span>{formatCurrency(total)}</span></div></div>
            </section>
          </article>
          <div className="payment-receipt-actions mx-auto mt-4 flex max-w-[72mm] flex-wrap justify-end gap-2 print:hidden"><button type="button" onClick={onPrint} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><FiPrinter /> Print Receipt</button><button type="button" onClick={onDownload} disabled={downloading} className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"><FiDownload /> {downloading ? "Preparing PDF..." : "Download PDF"}</button><button type="button" onClick={onClose} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Close</button></div>
        </div>
      </div>
    </div>, document.body
  );
};

const ReceiptField = ({ label, value }) => <div className="payment-receipt-field flex items-baseline justify-between gap-3"><span className="shrink-0 text-slate-500">{label}</span><span className="payment-receipt-value text-right font-semibold text-slate-800">{value || "-"}</span></div>;
const AmountRow = ({ label, value }) => <div className="flex justify-between gap-3 text-slate-600"><span>{label}</span><span className="font-medium text-slate-800">{formatCurrency(value)}</span></div>;

export default memo(PaymentReceipt);
