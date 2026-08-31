const CashPaymentConfirmationModal = ({ open, amount, loading, onClose, onConfirm }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/55 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <p className="text-sm font-medium uppercase tracking-wide text-amber-600">Cash Payment Confirmation</p>
        <h3 className="mt-1 text-2xl font-bold text-slate-900">Confirm payment received</h3>
        <p className="mt-3 text-sm text-slate-600">Amount: <span className="font-semibold text-slate-900">{amount}</span></p>
        <p className="mt-2 text-sm text-slate-600">Confirm that the customer has paid this amount in cash.</p>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={onConfirm} loading={loading} loadingText="Processing…">Confirm Cash Payment</Button>
        </div>
      </div>
    </div>
  );
};

export default CashPaymentConfirmationModal;
import Button from "../../ui/Button";
