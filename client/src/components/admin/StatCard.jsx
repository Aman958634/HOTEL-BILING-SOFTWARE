import { currency } from "../../utils/format";
import { formatGrowthTrend } from "../../utils/growthUtils";

const StatCard = ({ icon, label, value, trend = 0, formatValue }) => {
  const growth = formatGrowthTrend(trend);
  const toneClass =
    growth.type === "positive"
      ? "text-emerald-600"
      : growth.type === "negative"
        ? "text-red-600"
        : "text-slate-500";

  const shouldFormat =
    formatValue !== undefined
      ? formatValue
      : label.toLowerCase().includes("revenue") || label.toLowerCase().includes("amount");

  const displayValue = shouldFormat ? currency(value) : value;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="rounded-xl bg-slate-100 p-2 text-brand-700">{icon}</span>
        <span className={`text-xs font-semibold ${toneClass}`}>{growth.label}</span>
      </div>
      <p className="mt-3 text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{displayValue}</p>
    </div>
  );
};

export default StatCard;
