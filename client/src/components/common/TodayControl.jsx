import { memo, useRef, useState } from "react";
import { FiCalendar, FiChevronDown } from "react-icons/fi";

const toDateValue = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDate = (value) => {
  const [year, month, day] = String(value || "").split("-").map(Number);
  if (!year || !month || !day) return "Today";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(year, month - 1, day));
};

const TodayControl = ({ className = "", detailed = false }) => {
  const [selectedDate, setSelectedDate] = useState(() => toDateValue());
  const inputRef = useRef(null);
  const isToday = selectedDate === toDateValue();
  const label = isToday ? "Today" : formatDate(selectedDate);

  const openDatePicker = () => {
    const input = inputRef.current;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
        return;
      } catch {
        // Fall back to the native click path in browsers that restrict showPicker.
      }
    }
    input.focus();
    input.click();
  };

  return <div className={`relative min-w-0 ${className}`}>
    <input
      ref={inputRef}
      type="date"
      value={selectedDate}
      onChange={(event) => setSelectedDate(event.target.value || toDateValue())}
      className="today-control__input"
      tabIndex={-1}
      aria-label="Select reporting date"
    />
    <button
      type="button"
      onClick={openDatePicker}
      aria-label={`Choose reporting date: ${label}`}
      title={`Choose reporting date: ${label}`}
      className={`flex min-h-11 w-full min-w-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-2.5 py-1.5 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-1 ${detailed ? "shadow-sm" : ""}`}
    >
      <FiCalendar className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      <FiChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
    </button>
  </div>;
};

export default memo(TodayControl);