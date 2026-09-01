import { memo } from "react";
import { FiCalendar } from "react-icons/fi";

const TodayControl = ({ className = "" }) => <div aria-label="Current reporting period: Today" title="Current reporting period: Today" className={`flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-2.5 py-1.5 text-sm font-medium text-slate-700 ${className}`}>
  <FiCalendar className="h-4 w-4 shrink-0 text-slate-500" />
  <span className="min-w-0 truncate">Today</span>
</div>;

export default memo(TodayControl);
