import { FiSearch, FiUser } from "react-icons/fi";
import NotificationBell from "./NotificationBell";

const AdminHeader = ({ title = "Admin Dashboard", subtitle = "RestoSphere Main" }) => (
  <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        <label className="relative hidden sm:block">
          <FiSearch className="absolute left-3 top-3 text-slate-400" />
          <input
            className="rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm"
            placeholder="Search"
          />
        </label>
        <NotificationBell />
        <button className="rounded-xl border border-slate-300 p-2 text-slate-600">
          <FiUser />
        </button>
      </div>
    </div>
  </header>
);

export default AdminHeader;
