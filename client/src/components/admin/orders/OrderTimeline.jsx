const flow = ["PENDING", "CONFIRMED", "PREPARING", "READY", "SERVED", "COMPLETED"];

const fmt = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
};

const OrderTimeline = ({ history = [] }) => {
  const map = new Map(history.map((entry) => [String(entry.status).toUpperCase(), entry]));

  return (
    <div className="space-y-2">
      {flow.map((status) => {
        const entry = map.get(status);
        return (
          <div key={status} className="flex items-start gap-3">
            <div className={`mt-1 h-2.5 w-2.5 rounded-full ${entry ? "bg-emerald-500" : "bg-slate-300"}`} />
            <div>
              <p className="text-sm font-medium text-slate-800">{status}</p>
              <p className="text-xs text-slate-500">{entry ? fmt(entry.changedAt) : "Not reached"}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default OrderTimeline;
