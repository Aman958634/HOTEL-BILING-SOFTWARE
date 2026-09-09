import { useEffect } from "react";
import { FiCreditCard, FiDollarSign, FiSmartphone, FiX } from "react-icons/fi";
import { currency } from "../../../utils/format";
import Button from "../../ui/Button";

const METHODS = [
  { value: "CASH", label: "Cash", icon: FiDollarSign },
  { value: "UPI", label: "UPI", icon: FiSmartphone },
  { value: "CREDIT_CARD", label: "Card", icon: FiCreditCard },
  { value: "CASHFREE", label: "Cashfree", icon: FiSmartphone },
];

const RetryPaymentModal = ({ open, order, settlement, method, onMethodChange, loading, onClose, onConfirm }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => { if (event.key === "Escape" && !loading) onClose?.(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [loading, onClose, open]);

  if (!open || !order) return null;
  const amountDue = Number(settlement?.amountDue ?? order.total ?? 0);
  const alreadyPaid = Number(settlement?.alreadyPaid ?? 0);

  return (
    <div className="ui-modal-backdrop" role="presentation" onMouseDown={(event) => { if (!loading && event.target === event.currentTarget) onClose?.(); }}>
      <div className="ui-modal max-w-lg" role="dialog" aria-modal="true" aria-labelledby="retry-payment-title">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-emerald-600">Collect Payment</p>
            <h3 id="retry-payment-title" className="mt-1 text-xl font-bold text-slate-900">Order #{order.orderNumber}</h3>
            <p className="mt-1 text-sm text-slate-500">{order.customer?.fullName || "Guest"}</p>
          </div>
          <button type="button" onClick={onClose} disabled={loading} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50" aria-label="Close payment modal"><FiX className="h-5 w-5" /></button>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
          <div><p className="text-xs text-slate-500">Total Amount</p><p className="mt-1 font-semibold text-slate-900">{currency(order.total)}</p></div>
          <div><p className="text-xs text-slate-500">Already Paid</p><p className="mt-1 font-semibold text-slate-900">{currency(alreadyPaid)}</p></div>
          <div><p className="text-xs text-slate-500">Amount Due</p><p className="mt-1 font-semibold text-emerald-700">{currency(amountDue)}</p></div>
        </div>

        <fieldset className="mt-5">
          <legend className="text-sm font-semibold text-slate-900">Payment Method</legend>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {METHODS.map(({ value, label, icon: Icon }) => (
              <button key={value} type="button" onClick={() => onMethodChange(value)} disabled={loading} className={`inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-sm font-semibold transition ${method === value ? "border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-600/15" : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300"}`} aria-pressed={method === value}>
                <Icon className="h-4 w-4" aria-hidden="true" />{label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mt-6 grid grid-cols-1 gap-2 sm:flex sm:justify-end sm:gap-3">
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={onConfirm} loading={loading} loadingText="Processing..." disabled={amountDue <= 0} className="bg-teal-700 hover:bg-teal-800">Pay {currency(amountDue)}</Button>
        </div>
      </div>
    </div>
  );
};

export default RetryPaymentModal;
