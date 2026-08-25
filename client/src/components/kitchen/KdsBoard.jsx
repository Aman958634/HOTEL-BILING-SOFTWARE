import KotCard from "./KotCard";

const COLUMNS = [
  { key: "NEW", label: "New", filter: (t) => t.kitchenPhase === "NEW" },
  { key: "PREPARING", label: "Preparing", filter: (t) => ["PREPARING", "PARTIALLY_READY"].includes(t.kitchenPhase) },
  { key: "READY", label: "Ready", filter: (t) => t.kitchenPhase === "READY" },
  { key: "COMPLETED", label: "Completed", filter: (t) => ["SERVED", "COMPLETED"].includes(t.status) },
];

const KdsBoard = ({ tickets, thresholds, onItemStatusChange, onBulkStart, onBulkReady, onBulkComplete, canUpdate, canComplete }) => {
  return (
    <div className="grid gap-4 overflow-x-auto lg:grid-cols-5">
      {COLUMNS.map((col) => {
        const colTickets = tickets.filter(col.filter);
        return (
          <div key={col.key} className="flex h-full min-w-[300px] flex-col rounded-xl border border-slate-200 bg-slate-50/50">
            <div className="flex items-center justify-between border-b border-slate-200 p-3">
              <span className="text-sm font-bold text-slate-800">{col.label}</span>
              <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                {colTickets.length}
              </span>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-3">
              {colTickets.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-400">No tickets</p>
              ) : (
                colTickets.map((ticket) => (
                  <KotCard
                    key={ticket.orderId}
                    ticket={ticket}
                    thresholds={thresholds}
                    canUpdate={canUpdate}
                    onStatusChange={undefined}
                    onItemStatusChange={onItemStatusChange}
                    onBulkStart={() => onBulkStart(ticket.orderId)}
                    onBulkReady={() => onBulkReady(ticket.orderId)}
                    onBulkComplete={() => onBulkComplete(ticket.orderId)}
                    canComplete={canComplete}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default KdsBoard;
