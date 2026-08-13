const StatCard = ({ icon, label, value, trend = 0 }) => {
  const isPositive = trend >= 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="rounded-xl bg-slate-100 p-2 text-brand-700">{icon}</span>
        <span className={`text-xs font-semibold ${isPositive ? "text-emerald-600" : "text-red-600"}`}>
          {isPositive ? "+" : ""}
          {trend}%
        </span>
      </div>
      <p className="mt-3 text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
};

export default StatCard;
