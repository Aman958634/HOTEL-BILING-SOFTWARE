import { useEffect, useState } from "react";
import { FiCheckCircle, FiX } from "react-icons/fi";
import { formatCurrency } from "../../utils/paymentUtils";
import { formatPaymentId } from "../../utils/paymentId";
import { getPaymentAmount } from "../../utils/paymentUtils";

const RefundModal = ({ open, payment, loading, onClose, onSubmit }) => {
  const [refundType, setRefundType] = useState("full");
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");

  useEffect(() => {
    if (open) {
      setRefundType("full");
      setRefundAmount("");
      setRefundReason("");
    }
  }, [open, payment]);

  if (!open || !payment) return null;

  const refundable = Math.max(getPaymentAmount(payment) - Number(payment.refundAmount || 0), 0);

  const submit = (event) => {
    event.preventDefault();
    onSubmit({
      refundType,
      refundAmount: refundType === "partial" ? Number(refundAmount || 0) : refundable,
      refundReason,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <form onSubmit={submit} className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Refund Payment</h3>
            <p className="mt-1 text-sm text-slate-500">Are you sure you want to refund this payment?</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 p-2 text-slate-600">
            <FiX />
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <p><strong>Payment ID:</strong> {formatPaymentId(payment.paymentIdDisplay || payment.paymentId)}</p>
          <p><strong>Order ID:</strong> {payment.orderIdValue}</p>
          <p><strong>Refundable Amount:</strong> {formatCurrency(refundable)}</p>
        </div>

        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4">
            <input type="radio" name="refundType" value="full" checked={refundType === "full"} onChange={() => setRefundType("full")} />
            <span>
              <span className="block font-medium text-slate-900">Full Refund</span>
              <span className="block text-sm text-slate-500">Refund the remaining amount in full.</span>
            </span>
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4">
            <input type="radio" name="refundType" value="partial" checked={refundType === "partial"} onChange={() => setRefundType("partial")} />
            <span>
              <span className="block font-medium text-slate-900">Partial Refund</span>
              <span className="block text-sm text-slate-500">Enter a specific refund amount.</span>
            </span>
          </label>

          {refundType === "partial" ? (
            <input
              type="number"
              min="1"
              max={refundable}
              step="1"
              value={refundAmount}
              onChange={(event) => setRefundAmount(event.target.value)}
              placeholder="Refund amount"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100"
              required
            />
          ) : null}

          <textarea
            value={refundReason}
            onChange={(event) => setRefundReason(event.target.value)}
            placeholder="Refund reason"
            rows={4}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-700 focus:ring-2 focus:ring-brand-100"
            required
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-3 sm:justify-end">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700">
            Cancel
          </button>
          <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-70">
            <FiCheckCircle /> {loading ? "Processing..." : "Confirm Refund"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default RefundModal;
