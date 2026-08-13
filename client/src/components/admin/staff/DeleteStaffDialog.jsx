const DeleteStaffDialog = ({ open, loading, staff, onCancel, onConfirm }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <h3 className="text-lg font-semibold text-slate-900">Delete Staff</h3>
        <p className="mt-2 text-sm text-slate-600">This will permanently delete the staff record only if no historical records exist.</p>
        <p className="mt-2 text-sm font-medium text-slate-800">{staff?.fullName || staff?.employeeId || "Selected staff"}</p>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={onCancel} disabled={loading} className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="rounded-xl bg-rose-600 px-4 py-2 text-sm text-white disabled:opacity-70">{loading ? "Deleting..." : "Delete"}</button>
        </div>
      </div>
    </div>
  );
};

export default DeleteStaffDialog;
