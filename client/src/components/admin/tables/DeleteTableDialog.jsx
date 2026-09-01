import { memo } from "react";
import Button from "../../ui/Button";

const DeleteTableDialog = ({ open, loading, table, onCancel, onConfirm }) => {
  if (!open) return null;

  return (
    <div className="ui-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="delete-table-title">
      <div className="ui-modal max-h-[90dvh] max-w-[calc(100vw-1.5rem)] overflow-y-auto p-4 sm:max-w-md sm:p-6">
        <h3 id="delete-table-title" className="text-lg font-semibold text-slate-900">Delete Table</h3>
        <p className="mt-2 text-sm text-slate-600">Are you sure you want to delete this table?</p>
        {table?.tableNumber && <p className="mt-1 text-sm font-medium text-slate-800">Table {table.tableNumber}</p>}

        <div className="mt-5 grid grid-cols-1 gap-2 sm:mt-6 sm:grid-cols-2 sm:gap-3">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm} loading={loading} loadingText="Deleting…">Delete Table</Button>
        </div>
      </div>
    </div>
  );
};

export default memo(DeleteTableDialog);
