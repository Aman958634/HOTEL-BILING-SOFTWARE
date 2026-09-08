import { memo } from "react";
import { currency } from "../../utils/format";
import { formatGrowthTrend } from "../../utils/growthUtils";
import { getComparisonPeriodLabel } from "../../utils/comparisonPeriod";
import ModuleIcon from "../common/ModuleIcon";

const StatCard = ({ icon, iconModule = "dashboard", iconTone, label, value, trend = 0, formatValue, range = "today", comparisonType = "dashboard", compact = false, showComparison = true }) => {
  const growth = formatGrowthTrend(trend);
  const comparisonPeriod = getComparisonPeriodLabel(range, comparisonType);
  const toneClass = growth.type === "positive" ? "text-emerald-600" : growth.type === "negative" ? "text-rose-600" : "text-slate-500";
  const shouldFormat = formatValue !== undefined ? formatValue : label.toLowerCase().includes("revenue") || label.toLowerCase().includes("amount");
  const displayValue = shouldFormat ? currency(value) : value;
  const comparisonText = growth.label === "—"
    ? null
    : growth.label === "New"
      ? `New vs ${comparisonPeriod.replace("vs ", "")}`
      : `${growth.type === "positive" ? "+" : growth.type === "negative" ? "-" : ""}${growth.label} ${comparisonPeriod}`;

  return (
    <div className={`min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md ${compact ? "p-3 sm:p-4" : "p-5"}`}>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <ModuleIcon icon={icon} module={iconModule} tone={iconTone} variant="kpi" />
        {showComparison && comparisonText ? <p className={`min-w-0 text-right text-[11px] font-semibold leading-4 ${toneClass}`}>{comparisonText}</p> : null}
      </div>
      <div className={compact ? "mt-3" : "mt-4"}>
        <p className="truncate text-xs font-medium text-slate-500 sm:text-sm" title={label}>{label}</p>
        <p className={`${compact ? "text-xl sm:text-2xl" : "text-2xl"} mt-1 truncate font-bold tracking-tight text-slate-900`} title={String(displayValue)}>{displayValue}</p>
      </div>
    </div>
  );
};

export default memo(StatCard);
