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

const severityColor = {
  normal: "text-slate-500",
  warning: "text-amber-600",
  delayed: "text-orange-600",
  critical: "text-rose-600",
};

const KotCard = ({ ticket, thresholds, onStatusChange, onItemStatusChange, canUpdate, canComplete, onBulkStart, onBulkReady, onBulkComplete, pendingItemTransitions = {} }) => {
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
    <article className={`rounded-xl border bg-white shadow-sm ${phase === "NEW" ? "border-brand-400 ring-2 ring-brand-100" : "border-slate-200"}`}>
      <div className="border-b border-slate-100 p-2.5 sm:p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-slate-900">#{ticket.orderNumber}</p>
            <p className="text-xs text-slate-500">
              {ticket.table?.tableNumber ? `Table ${ticket.table.tableNumber}` : ORDER_TYPE_LABEL[ticket.orderType] || ticket.orderType}
            </p>
          </div>
          <div className="text-right">
            <span className={`inline-flex items-center gap-1 text-xs font-medium ${severityColor[sev]}`}>
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

      <div className="space-y-2 p-2.5 sm:p-3">
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
              className="w-full rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-100"
            >
              Start All
            </button>
          )}
          {phase === "PREPARING" && (
            <button
              onClick={() => onBulkReady?.(ticket.orderId)}
              className="w-full rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              Ready All
            </button>
          )}
          {phase === "READY" && canComplete && (
            <button
              onClick={() => onBulkComplete?.(ticket.orderId)}
              className="w-full rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-100"
            >
              Complete
            </button>
          )}
        </div>
      )}
    </article>
  );
};

export default memo(KotCard);
