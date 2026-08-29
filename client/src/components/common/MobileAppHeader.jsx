import { FiMenu, FiUser } from "react-icons/fi";
import { Link } from "react-router-dom";
import NotificationBell from "../admin/NotificationBell";
import GlobalSearch from "./GlobalSearch";

const MobileAppHeader = ({ onMenuClick }) => {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur-md">
      <div className="flex items-center justify-between gap-3 max-w-7xl mx-auto">
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100"
          aria-label="Open menu"
        >
          <FiMenu className="h-5 w-5" />
        </button>

        <div className="flex flex-col items-center">
          <h1 className="text-lg font-bold text-slate-900">RestoSphere</h1>
          <p className="text-xs text-slate-500">Restaurant Management</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="sm:hidden">
            <GlobalSearch className="block sm:hidden" compact />
          </div>
          <NotificationBell />
          <Link
            to="/profile"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100"
            aria-label="Profile"
          >
            <FiUser className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </header>
  );
};

export default MobileAppHeader;
