import { memo } from "react";
import { FiCalendar, FiChevronDown } from "react-icons/fi";

const TodayControl = ({ className = "" }) => <button type="button" aria-label="Reporting period: Today" className={`flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 ${className}`}>
  <FiCalendar className="h-4 w-4 shrink-0 text-slate-500" />
  <span className="min-w-0 truncate">Today</span>
  <FiChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
</button>;

export default memo(TodayControl);
