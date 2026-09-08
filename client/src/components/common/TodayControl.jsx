import { memo, useMemo } from "react";
import { FiCalendar } from "react-icons/fi";

const TodayControl = ({ className = "", detailed = false }) => {
  const dateLabel = useMemo(() => new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" }).format(new Date()), []);

  return <div aria-label={`Current reporting period: Today, ${dateLabel}`} title={`Current reporting period: Today, ${dateLabel}`} className={`flex min-h-11 min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-2.5 py-1.5 text-sm font-medium text-slate-700 ${detailed ? "shadow-sm transition hover:border-slate-300" : ""} ${className}`}>
    <FiCalendar className={`h-4 w-4 shrink-0 ${detailed ? "text-emerald-700" : "text-slate-500"}`} />
    <span className="min-w-0">
      {detailed ? <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Today</span> : null}
      <span className="block truncate text-sm font-semibold text-slate-800">{detailed ? dateLabel : "Today"}</span>
    </span>
  </div>;
};

export default memo(TodayControl);
