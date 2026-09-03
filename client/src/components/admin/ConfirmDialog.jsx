import { useEffect } from "react";
import Button from "../ui/Button";

const ConfirmDialog = ({ open, title, message, onConfirm, onCancel, loading }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => { if (event.key === "Escape" && !loading) onCancel?.(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [loading, onCancel, open]);

  if (!open) return null;

  return (
    <div className="ui-modal-backdrop z-[60]" role="presentation" onMouseDown={(event) => { if (!loading && event.target === event.currentTarget) onCancel?.(); }}>
      <div className="ui-modal max-w-md" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message">
        <h3 id="confirm-dialog-title" className="text-lg font-semibold text-slate-900">{title}</h3>
        <p id="confirm-dialog-message" className="mt-2 whitespace-pre-line break-words text-sm text-slate-600">{message}</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm} loading={loading} loadingText="Deleting…">Delete</Button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
