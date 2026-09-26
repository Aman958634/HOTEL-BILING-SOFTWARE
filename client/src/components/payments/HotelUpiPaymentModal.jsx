import { useEffect, useState } from "react";
import { FiCheckCircle, FiCopy, FiDownload, FiExternalLink, FiRefreshCw, FiX } from "react-icons/fi";
import toast from "react-hot-toast";
import { currency } from "../../utils/format";
import Button from "../ui/Button";

const HotelUpiPaymentModal = ({ open, order, payment, loading = false, onGenerate, onRefreshStatus, onReceipt, onClose }) => {
  const [openedUpi, setOpenedUpi] = useState(false);
  const data = payment?.data || payment || {};
  const paymentRecord = data.payment || {};
  const expiryTimestamp = data.expiresAt ? Date.parse(data.expiresAt) : paymentRecord.createdAt ? new Date(paymentRecord.createdAt).getTime() + 15 * 60 * 1000 : Number.NaN;
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!open) setOpenedUpi(false);
  }, [open]);

  useEffect(() => {
    if (!open || !Number.isFinite(expiryTimestamp)) return undefined;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [expiryTimestamp, open]);

  if (!open || !order) return null;

  const amount = Number(data.amount || order.total || 0);
  const status = String(data.paymentStatus || paymentRecord.paymentStatus || "AWAITING_VERIFICATION").toUpperCase();
  const expired = Number.isFinite(expiryTimestamp) && expiryTimestamp <= now;
  const secondsRemaining = Number.isFinite(expiryTimestamp) ? Math.max(0, Math.ceil((expiryTimestamp - now) / 1000)) : null;
  const expiryLabel = secondsRemaining === null ? "" : `${Math.floor(secondsRemaining / 60)}:${String(secondsRemaining % 60).padStart(2, "0")}`;
  const retryable = expired || ["FAILED", "PENDING", "EXPIRED"].includes(status);
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

        {loading ? <div className="mt-6 h-72 animate-pulse rounded-2xl bg-slate-100" aria-busy="true" /> : status === "PAID" ? (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"><p className="flex items-center gap-2 font-semibold"><FiCheckCircle aria-hidden="true" />Payment verified by an authorized cashier</p><p className="mt-1">The ledger and order status have been refreshed. Download the receipt from the verified payment record.</p></div>
        ) : data.qrCode && !expired && status === "AWAITING_VERIFICATION" ? (
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
              <p className="flex items-center justify-between gap-3 font-semibold"><span>Awaiting hotel verification</span><span className="tabular-nums">Expires in {expiryLabel || "15:00"}</span></p>
              <p className="mt-1">This QR is for the exact backend-calculated outstanding balance. Partial Hotel UPI collection is not supported. A QR display, UPI app launch, screenshot, or customer confirmation does not mark this order paid; a different authorized cashier must verify the actual bank credit.</p>
            </div>

            <div className="grid gap-2 sm:flex sm:justify-end">
              <Button variant="secondary" onClick={onRefreshStatus} disabled={loading}><FiRefreshCw aria-hidden="true" />Refresh status</Button>
              <Button variant="secondary" onClick={onClose} disabled={loading}>Close</Button>
              {data.upiLink ? <a href={data.upiLink} onClick={() => setOpenedUpi(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"><FiExternalLink aria-hidden="true" />Open UPI app</a> : null}
            </div>
            {openedUpi || status === "AWAITING_VERIFICATION" ? <p className="flex items-center gap-2 text-sm font-medium text-slate-600"><FiCheckCircle className="text-emerald-600" aria-hidden="true" />Payment record is awaiting verification.</p> : null}
          </div>
        ) : retryable ? (
          <div className="mt-5 space-y-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
            <p className="font-semibold">{status === "PENDING" ? "Payment attempt rejected" : "Hotel UPI QR expired"}</p>
            <p>{paymentRecord.metadata?.rejectionNote || "This attempt is no longer payable. Generate a new QR before accepting another payment."}</p>
            <div className="flex flex-wrap gap-2"><Button onClick={onGenerate} loading={loading} loadingText="Generating..." className="bg-emerald-700 hover:bg-emerald-800">Generate new QR</Button><Button variant="secondary" onClick={onRefreshStatus} disabled={loading}><FiRefreshCw aria-hidden="true" />Refresh status</Button><Button variant="secondary" onClick={onClose} disabled={loading}>Close</Button></div>
          </div>
        ) : (
          <div className="mt-5 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700"><p>Payment status: <strong>{status.replaceAll("_", " ")}</strong></p><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={onRefreshStatus} disabled={loading}><FiRefreshCw aria-hidden="true" />Refresh status</Button><Button variant="secondary" onClick={onClose} disabled={loading}>Close</Button></div></div>
        )}
        {status === "PAID" ? <div className="mt-4 flex flex-wrap justify-end gap-2"><Button onClick={onReceipt} className="bg-emerald-700 hover:bg-emerald-800"><FiDownload aria-hidden="true" />Download receipt</Button><Button variant="secondary" onClick={onClose}>Close</Button></div> : null}
      </div>
    </div>
  );
};

export default HotelUpiPaymentModal;
