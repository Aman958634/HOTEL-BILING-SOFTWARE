import { useEffect, useState } from "react";
import { FiAlertTriangle, FiCheck, FiX } from "react-icons/fi";
import { currency } from "../../utils/format";
import Button from "../ui/Button";

const HotelUpiVerificationModal = ({ open, payment, loading = false, onClose, onVerify, onReject }) => {
  const [transactionId, setTransactionId] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) {
      setTransactionId("");
      setNote("");
    }
  }, [open]);

  if (!open || !payment) return null;
  const order = payment.order || {};
  const amount = Number(payment.totalAmount ?? payment.amount ?? 0);
  const paymentId = payment.paymentIdDisplay || payment.paymentId || payment._id;

  return (
    <div className="ui-modal-backdrop" role="presentation" onMouseDown={(event) => { if (!loading && event.target === event.currentTarget) onClose?.(); }}>
      <div className="ui-modal max-w-lg" role="dialog" aria-modal="true" aria-labelledby="hotel-upi-verify-title">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Manual verification</p><h2 id="hotel-upi-verify-title" className="mt-1 text-xl font-bold text-slate-900">Confirm hotel UPI receipt</h2></div>
          <button type="button" onClick={onClose} disabled={loading} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close verification"><FiX className="h-5 w-5" /></button>
        </div>

        <div className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
          <div><p className="text-xs text-slate-500">Payment ID</p><p className="mt-1 break-all font-mono font-semibold text-slate-900">{paymentId}</p></div>
          <div><p className="text-xs text-slate-500">Order</p><p className="mt-1 font-semibold text-slate-900">#{order.orderNumber || payment.orderIdValue || "—"}</p></div>
          <div><p className="text-xs text-slate-500">Exact amount</p><p className="mt-1 text-lg font-bold text-emerald-700">{currency(amount)}</p></div>
          <div><p className="text-xs text-slate-500">Current state</p><p className="mt-1 font-semibold text-amber-700">Awaiting verification</p></div>
        </div>

        <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900"><p className="flex items-center gap-2 font-semibold"><FiAlertTriangle aria-hidden="true" />Check the actual hotel bank/UPI statement</p><p className="mt-1">Only continue when the amount, payment reference and recipient account match. Do not approve from the customer screenshot or an opened UPI app alone.</p></div>

        <label className="mt-5 block text-sm font-semibold text-slate-800" htmlFor="hotel-upi-transaction-reference">Bank/UPI transaction reference<input id="hotel-upi-transaction-reference" value={transactionId} onChange={(event) => setTransactionId(event.target.value)} maxLength={200} placeholder="Enter the reference shown in the hotel account" className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15" /></label>
        <label className="mt-3 block text-sm font-semibold text-slate-800" htmlFor="hotel-upi-rejection-note">Review note <span className="font-normal text-slate-500">(required when rejecting)</span><textarea id="hotel-upi-rejection-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={2} placeholder="Optional for approval; required for rejection" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15" /></label>

        <div className="mt-6 grid gap-2 sm:flex sm:justify-end"><Button variant="secondary" onClick={() => onReject?.(note)} disabled={loading || !note.trim()}><FiX aria-hidden="true" />Reject</Button><Button onClick={() => onVerify?.(transactionId)} loading={loading} loadingText="Verifying..." disabled={loading || !transactionId.trim()} className="bg-emerald-700 hover:bg-emerald-800"><FiCheck aria-hidden="true" />Verify bank receipt</Button></div>
      </div>
    </div>
  );
};

export default HotelUpiVerificationModal;
