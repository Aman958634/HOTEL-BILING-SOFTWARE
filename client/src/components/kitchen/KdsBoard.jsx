import { memo } from "react";
import KotCard from "./KotCard";

const COLUMNS = [
  { key: "NEW", label: "New", emptyLabel: "No new tickets", filter: (ticket) => ticket.kitchenPhase === "NEW" },
  { key: "PREPARING", label: "Preparing", emptyLabel: "No preparing tickets", filter: (ticket) => ["PREPARING", "PARTIALLY_READY"].includes(ticket.kitchenPhase) },
  { key: "READY", label: "Ready", emptyLabel: "No ready tickets", filter: (ticket) => ticket.kitchenPhase === "READY" },
  { key: "COMPLETED", label: "Completed", emptyLabel: "No completed tickets", filter: (ticket) => ticket.kitchenPhase === "COMPLETED" || ["SERVED", "COMPLETED"].includes(ticket.status) },
];

const KdsBoard = ({ tickets, thresholds, onItemStatusChange, onBulkStart, onBulkReady, onBulkComplete, canUpdate, canComplete }) => {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:h-[calc(100vh-17rem)] xl:grid-cols-4">
      {COLUMNS.map((col) => {
        const colTickets = tickets.filter(col.filter);
        return (
          <section key={col.key} className="flex h-[min(28rem,calc(100vh-15rem))] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70 shadow-sm md:h-[calc(50vh-8rem)] xl:h-full">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
              <span className="text-sm font-bold uppercase tracking-wide text-slate-800">{col.label}</span>
              <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                {colTickets.length}
              </span>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3">
              {colTickets.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">{col.emptyLabel}</p>
              ) : (
                colTickets.map((ticket) => (
                  <KotCard
                    key={ticket.orderId}
                    ticket={ticket}
                    thresholds={thresholds}
                    canUpdate={canUpdate}
                    onItemStatusChange={onItemStatusChange}
                    onBulkStart={onBulkStart}
                    onBulkReady={onBulkReady}
                    onBulkComplete={onBulkComplete}
                    canComplete={canComplete}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
};

export default memo(KdsBoard);
