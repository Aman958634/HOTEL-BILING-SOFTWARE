import { useState } from "react";

const STATUS_CONFIG = {
  NEW: { label: "New", className: "border-slate-200 bg-slate-50 text-slate-700" },
  PREPARING: { label: "Preparing", className: "border-amber-200 bg-amber-50 text-amber-700" },
  READY: { label: "Ready", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  SERVED: { label: "Served", className: "border-sky-200 bg-sky-50 text-sky-700" },
  CANCELLED: { label: "Cancelled", className: "border-rose-200 bg-rose-50 text-rose-700 line-through" },
};

const KitchenItem = ({ item, onStatusChange, canUpdate }) => {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const status = String(item.kitchenStatus || "NEW").toUpperCase();
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.NEW;

  const handleCancel = () => {
    if (!confirmCancel) {
      setConfirmCancel(true);
      return;
    }
    onStatusChange?.(item.index, "CANCELLED");
    setConfirmCancel(false);
  };

  return (
    <div className={`rounded-lg border p-2.5 transition ${cfg.className}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-semibold text-slate-900">
            {item.quantity}× {item.name}
          </p>
          {item.specialInstructions ? (
            <p className="mt-1 break-words text-xs italic text-slate-600">"{item.specialInstructions}"</p>
          ) : null}
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${cfg.className}`}>
          {cfg.label}
        </span>
      </div>

      {canUpdate && status !== "CANCELLED" && status !== "SERVED" && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {status === "NEW" && (
            <button
              onClick={() => onStatusChange?.(item.index, "PREPARING")}
              className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
            >
              Start
            </button>
          )}
          {status === "PREPARING" && (
            <button
              onClick={() => onStatusChange?.(item.index, "READY")}
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
            >
              Ready
            </button>
          )}
          {status === "READY" && (
            <button
              onClick={() => onStatusChange?.(item.index, "SERVED")}
              className="rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100"
            >
              Serve
            </button>
          )}
          <button
            onClick={handleCancel}
            className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
              confirmCancel ? "border-rose-300 bg-rose-100 text-rose-800" : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
            }`}
          >
            {confirmCancel ? "Confirm Cancel" : "Cancel"}
          </button>
        </div>
      )}
    </div>
  );
};

export default KitchenItem;
