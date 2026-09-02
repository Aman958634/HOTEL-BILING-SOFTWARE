import { memo, useMemo } from "react";
import { FiClock, FiAlertTriangle } from "react-icons/fi";
import KitchenItem from "./KitchenItem";
import { deriveKitchenTicketStage, getKitchenTicketKey } from "../../utils/kitchenTicketState";

const ORDER_TYPE_LABEL = {
  DINE_IN: "Dine-in",
  TAKEAWAY: "Takeaway",
  DELIVERY: "Delivery",
};

const fmtDuration = (mins) => {
  const m = Math.max(0, Math.round(mins));
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

const waitSeverity = (mins, thresholds) => {
  if (mins >= thresholds.critical) return "critical";
  if (mins >= thresholds.delayed) return "delayed";
  if (mins >= thresholds.warning) return "warning";
  return "normal";
};

const KotCard = ({ ticket, thresholds, onStatusChange, onItemStatusChange, canUpdate, canComplete, onBulkStart, onBulkReady, onBulkComplete, pendingItemTransitions = {}, pendingAction = "" }) => {
  const createdAt = new Date(ticket.createdAt).getTime();
  const mins = Math.max(0, Math.round((Date.now() - createdAt) / 60000));
  const sev = waitSeverity(mins, thresholds);

  const activeItems = useMemo(
    () => (ticket.items || []).filter((i) => String(i.kitchenStatus || "NEW").toUpperCase() !== "CANCELLED"),
    [ticket.items]
  );
  const readyCount = activeItems.filter((i) => String(i.kitchenStatus || "NEW").toUpperCase() === "READY").length;
  const preparingCount = activeItems.filter((i) => String(i.kitchenStatus || "NEW").toUpperCase() === "PREPARING").length;
  const newCount = activeItems.filter((i) => String(i.kitchenStatus || "NEW").toUpperCase() === "NEW").length;
  const phase = deriveKitchenTicketStage(ticket);

  const canTakeBulkAction = canUpdate && ["NEW", "PREPARING", "READY"].includes(phase);

  return (
    <article className={`rounded-xl border bg-white shadow-sm ${sev === "critical" ? "border-rose-400 ring-2 ring-rose-100" : sev === "delayed" ? "border-orange-300 ring-1 ring-orange-100" : phase === "NEW" ? "border-brand-400 ring-2 ring-brand-100" : phase === "COMPLETED" ? "border-slate-200 opacity-80" : "border-slate-200"}`}>
      <div className="border-b border-slate-100 p-2.5 sm:p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">KOT #{ticket.orderNumber}</p>
            <p className="mt-0.5 text-sm font-bold text-slate-900">
              {ticket.table?.tableNumber ? `Table ${ticket.table.tableNumber}` : ORDER_TYPE_LABEL[ticket.orderType] || ticket.orderType || "Order"}
            </p>
          </div>
          <div className="text-right">
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-bold ${sev === "critical" ? "border-rose-200 bg-rose-50 text-rose-700" : sev === "delayed" ? "border-orange-200 bg-orange-50 text-orange-700" : sev === "warning" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
              <FiClock /> {fmtDuration(mins)}
            </span>
            {sev === "delayed" || sev === "critical" ? (
              <span className="ml-1 inline-flex items-center gap-1 text-xs font-medium text-rose-600">
                <FiAlertTriangle /> DELAYED
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 font-medium">
            {newCount} new
          </span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-medium text-amber-700">
            {preparingCount} prep
          </span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
            {readyCount} ready
          </span>
          {phase === "PARTIALLY_READY" && (
            <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 font-medium text-sky-700">
              Partially Ready
            </span>
          )}
        </div>
      </div>

      <div className="space-y-1.5 p-2.5 sm:p-3">
        {(ticket.items || []).map((item) => (
          <KitchenItem
            key={item.index}
            item={item}
            canUpdate={canUpdate && phase !== "COMPLETED"}
            pending={Object.keys(pendingItemTransitions).some((key) => key.startsWith(`${getKitchenTicketKey(ticket)}:${item.index}:`))}
            onStatusChange={(itemIndex, kitchenStatus) =>
              onItemStatusChange?.(ticket.orderId, itemIndex, kitchenStatus)
            }
          />
        ))}
      </div>

      {canTakeBulkAction && (
        <div className="border-t border-slate-100 p-2.5 sm:p-3">
          {phase === "NEW" && (
            <button
              onClick={() => onBulkStart?.(ticket.orderId)}
              disabled={Boolean(pendingAction)}
              className="min-h-11 w-full rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-wait disabled:opacity-60"
            >
              {pendingAction ? "Starting…" : "Start"}
            </button>
          )}
          {phase === "PREPARING" && (
            <button
              onClick={() => onBulkReady?.(ticket.orderId)}
              disabled={Boolean(pendingAction)}
              className="min-h-11 w-full rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
            >
              {pendingAction ? "Marking ready…" : "Mark Ready"}
            </button>
          )}
          {phase === "READY" && canComplete && (
            <button
              onClick={() => onBulkComplete?.(ticket.orderId)}
              disabled={Boolean(pendingAction)}
              className="min-h-11 w-full rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-800 disabled:cursor-wait disabled:opacity-60"
            >
              {pendingAction ? "Completing…" : "Complete"}
            </button>
          )}
        </div>
      )}
    </article>
  );
};

export default memo(KotCard);
