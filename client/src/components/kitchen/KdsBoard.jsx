import { memo } from "react";
import KotCard from "./KotCard";

const COLUMNS = [
  { key: "NEW", label: "New", emptyLabel: "No new tickets" },
  { key: "PREPARING", label: "Preparing", emptyLabel: "No preparing tickets" },
  { key: "READY", label: "Ready", emptyLabel: "No ready tickets" },
  { key: "COMPLETED", label: "Completed", emptyLabel: "No completed tickets" },
];

const KdsBoard = ({ groupedTickets, thresholds, onItemStatusChange, onBulkStart, onBulkReady, onBulkComplete, canUpdate, canComplete, pendingItemTransitions, pendingTicketActions, mobileStage, onMobileStageChange }) => {
  return (
    <div>
      <div className="mb-3 grid grid-cols-4 gap-1 rounded-xl border border-slate-200 bg-white p-1 md:hidden" role="tablist" aria-label="Kitchen ticket status">
        {COLUMNS.map((column) => {
          const selected = mobileStage === column.key;
          const label = column.key === "PREPARING" ? "Prep" : column.key === "COMPLETED" ? "Done" : column.label;
          return <button key={column.key} type="button" role="tab" aria-selected={selected} onClick={() => onMobileStageChange(column.key)} className={`min-h-11 min-w-0 rounded-lg px-0.5 text-[10px] font-semibold sm:px-1 sm:text-[11px] ${selected ? "bg-brand-700 text-white" : "text-slate-600"}`}>{label}<span className="ml-1">{(groupedTickets[column.key] || []).length}</span></button>;
        })}
      </div>
      <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-4">
      {COLUMNS.map((col) => {
        const colTickets = groupedTickets[col.key] || [];
        return (
          <section key={col.key} className={`${mobileStage === col.key ? "flex" : "hidden"} min-w-0 flex-col self-start rounded-xl border border-slate-200 bg-slate-50/70 shadow-sm md:flex md:rounded-2xl`}>
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 py-2.5 sm:px-4 sm:py-3">
              <span className="text-sm font-bold uppercase tracking-wide text-slate-800">{col.label}</span>
              <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                {colTickets.length}
              </span>
            </div>
            <div className="space-y-2.5 p-2.5 md:p-3">
              {colTickets.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">{col.emptyLabel}</p>
              ) : (
                colTickets.map((ticket) => (
                  <KotCard
                    key={ticket.kotId || ticket.orderId}
                    ticket={ticket}
                    thresholds={thresholds}
                    canUpdate={canUpdate}
                    onItemStatusChange={onItemStatusChange}
                    onBulkStart={onBulkStart}
                    onBulkReady={onBulkReady}
                    onBulkComplete={onBulkComplete}
                    canComplete={canComplete}
                    pendingItemTransitions={pendingItemTransitions}
                    pendingAction={pendingTicketActions?.[String(ticket.orderId)]}
                  />
                ))
              )}
            </div>
          </section>
        );
      })}
      </div>
    </div>
  );
};

export default memo(KdsBoard);
