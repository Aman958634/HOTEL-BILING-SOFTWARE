import { useEffect, useState } from "react";
import { FiCheck, FiX } from "react-icons/fi";
import { currency } from "../../utils/format";
import Button from "../ui/Button";

const HotelUpiVerificationModal = ({ open, payment, order: suppliedOrder, loading = false, onClose, onVerify, onReject }) => {
  const [transactionId, setTransactionId] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!open) {
      setTransactionId("");
      setNote("");
    }
  }, [open]);

  if (!open || !payment) return null;
  const order = suppliedOrder || payment.order || {};
  const amount = Number(payment.totalAmount ?? payment.amount ?? 0);

  return (
    <div className="ui-modal-backdrop" role="presentation" onMouseDown={(event) => { if (!loading && event.target === event.currentTarget) onClose?.(); }}>
      <div className="ui-modal max-w-lg" role="dialog" aria-modal="true" aria-labelledby="hotel-upi-verify-title">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Payment received</p><h2 id="hotel-upi-verify-title" className="mt-1 text-xl font-bold text-slate-900">Confirm Payment Received</h2></div>
          <button type="button" onClick={onClose} disabled={loading} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close payment confirmation"><FiX className="h-5 w-5" /></button>
        </div>

        <p className="mt-4 text-sm leading-6 text-slate-600">Please confirm that <strong>{currency(amount)}</strong> has been received in the hotel&apos;s bank/UPI account.</p>
        <div className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
          <div><p className="text-xs text-slate-500">Order</p><p className="mt-1 font-semibold text-slate-900">#{order.orderNumber || payment.orderIdValue || "—"}</p></div>
          <div><p className="text-xs text-slate-500">Amount received</p><p className="mt-1 text-lg font-bold text-emerald-700">{currency(amount)}</p></div>
          <div><p className="text-xs text-slate-500">Method</p><p className="mt-1 font-semibold text-slate-900">UPI</p></div>
          <div><p className="text-xs text-slate-500">Payment status</p><p className="mt-1 font-semibold text-amber-700">Awaiting Payment Confirmation</p></div>
        </div>

        <label className="mt-5 block text-sm font-semibold text-slate-800" htmlFor="hotel-upi-transaction-reference">UPI Transaction / Reference ID <span className="font-normal text-slate-500">(optional)</span><input id="hotel-upi-transaction-reference" value={transactionId} onChange={(event) => setTransactionId(event.target.value)} maxLength={200} placeholder="Enter the reference from the hotel account" className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15" /></label>
        {onReject ? <label className="mt-3 block text-sm font-semibold text-slate-800" htmlFor="hotel-upi-rejection-note">Reason payment was not received <span className="font-normal text-slate-500">(required to reject)</span><textarea id="hotel-upi-rejection-note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={2} placeholder="Add a short note" className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15" /></label> : null}

        <div className="mt-6 grid gap-2 sm:flex sm:justify-end"><Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>{onReject ? <Button variant="secondary" onClick={() => onReject?.(note)} disabled={loading || !note.trim()}><FiX aria-hidden="true" />Not received</Button> : null}<Button onClick={() => onVerify?.(transactionId.trim())} loading={loading} loadingText="Confirming..." disabled={loading} className="bg-emerald-700 hover:bg-emerald-800"><FiCheck aria-hidden="true" />Confirm Payment</Button></div>
      </div>
    </div>
  );
};

export default HotelUpiVerificationModal;
