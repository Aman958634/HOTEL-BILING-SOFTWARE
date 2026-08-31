const DeleteStaffDialog = ({ open, loading, staff, onCancel, onConfirm }) => {
  if (!open) return null;

  return (
    <div className="ui-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-staff-title">
      <div className="ui-modal max-w-md">
        <h3 id="delete-staff-title" className="text-lg font-semibold text-slate-900">Delete Staff</h3>
        <p className="mt-2 text-sm text-slate-600">This will permanently delete the staff record only if no historical records exist.</p>
        <p className="mt-2 text-sm font-medium text-slate-800">{staff?.fullName || staff?.employeeId || "Selected staff"}</p>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm} loading={loading} loadingText="Deleting…">Delete</Button>
        </div>
      </div>
    </div>
  );
};

export default DeleteStaffDialog;
import Button from "../../ui/Button";
