import { memo } from "react";
import { currency } from "../../utils/format";
import { formatGrowthTrend } from "../../utils/growthUtils";
import { getComparisonPeriodLabel } from "../../utils/comparisonPeriod";

const StatCard = ({ icon, label, value, trend = 0, formatValue, range = "today", comparisonType = "dashboard" }) => {
  const growth = formatGrowthTrend(trend);
  const comparisonPeriod = getComparisonPeriodLabel(range, comparisonType);
  
  const toneClass =
    growth.type === "positive"
      ? "text-emerald-600"
      : growth.type === "negative"
        ? "text-rose-600"
        : "text-slate-500";

  const shouldFormat =
    formatValue !== undefined
      ? formatValue
      : label.toLowerCase().includes("revenue") || label.toLowerCase().includes("amount");

  const displayValue = shouldFormat ? currency(value) : value;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600" aria-hidden="true">
          {icon}
        </div>
        <div className={`flex flex-col items-end gap-1 text-xs font-semibold ${toneClass}`}>
          <div className="flex items-center gap-1">
            {growth.type === "positive" && <span>↑</span>}
            {growth.type === "negative" && <span>↓</span>}
            {growth.label}
          </div>
          {growth.label !== "—" && growth.label !== "New" && (
            <div className="text-slate-400 text-xs font-normal">{comparisonPeriod}</div>
          )}
        </div>
      </div>
      <div className="mt-4">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-bold text-slate-900">{displayValue}</p>
      </div>
    </div>
  );
};

export default memo(StatCard);
