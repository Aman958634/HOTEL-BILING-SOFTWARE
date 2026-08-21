import { FiCalendar, FiChevronDown, FiSearch } from "react-icons/fi";
import NotificationBell from "./NotificationBell";

const AdminHeader = ({ title = "Dashboard", subtitle = "Welcome back, Admin!" }) => {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="hidden md:block">
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <label className="relative hidden sm:block">
            <FiSearch className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              className="h-10 w-64 rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10"
              placeholder="Search anything..."
            />
          </label>

          <button className="flex items-center gap-2 rounded-xl border border-slate-200 px-2.5 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
            <FiCalendar className="h-4 w-4 text-slate-500" />
            <span className="hidden md:inline">Today</span>
            <FiChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          <div className="relative">
            <NotificationBell />
          </div>

          <button className="flex items-center gap-2 rounded-xl border border-slate-200 px-2 py-1.5 text-slate-600 transition-colors hover:bg-slate-50">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-xs font-bold text-white">
              A
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium leading-tight text-slate-900">Admin</p>
              <p className="text-xs leading-tight text-slate-500">Administrator</p>
            </div>
            <FiChevronDown className="hidden md:block h-3.5 w-3.5 text-slate-400" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default AdminHeader;
