import { useEffect } from "react";
import Button from "../../ui/Button";

const CashPaymentConfirmationModal = ({ open, amount, loading, onClose, onConfirm }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => { if (event.key === "Escape" && !loading) onClose?.(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [loading, onClose, open]);

  if (!open) return null;

  return (
    <div className="ui-modal-backdrop z-[60]" role="presentation" onMouseDown={(event) => { if (!loading && event.target === event.currentTarget) onClose?.(); }}>
      <div className="ui-modal max-w-md" role="dialog" aria-modal="true" aria-labelledby="cash-payment-title" aria-describedby="cash-payment-description">
        <p className="text-sm font-medium uppercase tracking-wide text-amber-600">Cash Payment Confirmation</p>
        <h3 id="cash-payment-title" className="mt-1 text-2xl font-bold text-slate-900">Confirm payment received</h3>
        <p className="mt-3 text-sm text-slate-600">Amount: <span className="font-semibold text-slate-900">{amount}</span></p>
        <p id="cash-payment-description" className="mt-2 text-sm text-slate-600">Confirm that the customer has paid this amount in cash.</p>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={onConfirm} loading={loading} loadingText="Processing…">Confirm Cash Payment</Button>
        </div>
      </div>
    </div>
  );
};

export default CashPaymentConfirmationModal;
