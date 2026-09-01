import { memo } from "react";
import { FiMenu, FiUser } from "react-icons/fi";
import { Link } from "react-router-dom";
import NotificationBell from "../admin/NotificationBell";
import GlobalSearch from "./GlobalSearch";
import OutletSwitcher from "../admin/OutletSwitcher";

const MobileAppHeader = ({ onMenuClick }) => {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur-md">
      <div className="mx-auto flex min-w-0 max-w-7xl items-center justify-between gap-2">
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100"
          aria-label="Open menu"
        >
          <FiMenu className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1 text-center">
          <h1 className="truncate text-lg font-bold text-slate-900">RestoSphere</h1>
          <p className="truncate text-xs text-slate-500">Restaurant Management</p>
        </div>
        <div className="hidden sm:block"><OutletSwitcher /></div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
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

export default memo(MobileAppHeader);
