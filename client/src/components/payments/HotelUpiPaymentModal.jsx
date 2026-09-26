import { useEffect, useState } from "react";
import { FiCheckCircle, FiCopy, FiExternalLink, FiX } from "react-icons/fi";
import toast from "react-hot-toast";
import { currency } from "../../utils/format";
import Button from "../ui/Button";

const HotelUpiPaymentModal = ({ open, order, payment, loading = false, onGenerate, onClose }) => {
  const [openedUpi, setOpenedUpi] = useState(false);

  useEffect(() => {
    if (!open) setOpenedUpi(false);
  }, [open]);

  if (!open || !order) return null;

  const data = payment?.data || payment || {};
  const paymentRecord = data.payment || {};
  const amount = Number(data.amount || order.total || 0);
  const status = String(data.paymentStatus || paymentRecord.paymentStatus || "AWAITING_VERIFICATION").toUpperCase();
  const copy = async (value, label) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Unable to copy ${label.toLowerCase()}`);
    }
  };

  return (
    <div className="ui-modal-backdrop" role="presentation" onMouseDown={(event) => { if (!loading && event.target === event.currentTarget) onClose?.(); }}>
      <div className="ui-modal max-w-xl" role="dialog" aria-modal="true" aria-labelledby="hotel-upi-payment-title">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Hotel UPI payment</p>
            <h2 id="hotel-upi-payment-title" className="mt-1 text-xl font-bold text-slate-900">Order #{order.orderNumber}</h2>
            <p className="mt-1 text-sm text-slate-500">Scan the server-generated QR and pay the exact amount.</p>
          </div>
          <button type="button" onClick={onClose} disabled={loading} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Close hotel UPI payment"><FiX className="h-5 w-5" /></button>
        </div>

        {loading ? <div className="mt-6 h-72 animate-pulse rounded-2xl bg-slate-100" aria-busy="true" /> : data.qrCode ? (
          <div className="mt-5 space-y-4">
            <div className="grid gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:grid-cols-[auto_1fr]">
              <div className="mx-auto rounded-xl bg-white p-3 shadow-sm"><img src={data.qrCode} alt={`UPI QR for order ${order.orderNumber}`} className="h-52 w-52" /></div>
              <div className="min-w-0 space-y-3 text-sm text-slate-700">
                <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payee</p><p className="mt-1 break-words font-semibold text-slate-900">{data.payeeName || "Hotel account"}</p></div>
                <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">UPI ID</p><div className="mt-1 flex items-center gap-2"><p className="min-w-0 break-all font-mono text-slate-900">{data.upiId || "Not provided"}</p>{data.upiId ? <button type="button" onClick={() => copy(data.upiId, "UPI ID")} className="shrink-0 rounded-lg p-2 text-emerald-700 hover:bg-white" aria-label="Copy hotel UPI ID"><FiCopy /></button> : null}</div></div>
                <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Exact amount</p><p className="mt-1 text-2xl font-bold text-emerald-800">{currency(amount)}</p></div>
                <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Payment ID</p><p className="mt-1 break-all font-mono text-xs text-slate-700">{paymentRecord.paymentId || data.paymentId || "Pending"}</p></div>
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">Awaiting hotel verification</p>
              <p className="mt-1">This QR is valid for 15 minutes and is for the exact outstanding balance. Partial Hotel UPI collection is not supported. A QR display, UPI app launch, or customer confirmation does not mark this order paid; hotel staff must match the bank/UPI transaction before approval.</p>
            </div>

            <div className="grid gap-2 sm:flex sm:justify-end">
              <Button variant="secondary" onClick={onClose} disabled={loading}>Close</Button>
              <a href={data.upiLink} onClick={() => setOpenedUpi(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"><FiExternalLink aria-hidden="true" />Open UPI app</a>
            </div>
            {openedUpi || status === "AWAITING_VERIFICATION" ? <p className="flex items-center gap-2 text-sm font-medium text-slate-600"><FiCheckCircle className="text-emerald-600" aria-hidden="true" />Payment record is awaiting verification.</p> : null}
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Unable to generate the hotel QR. Close this window and retry.</div>
        )}
      </div>
    </div>
  );
};

export default HotelUpiPaymentModal;
