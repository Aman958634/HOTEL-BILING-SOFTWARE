import { memo } from "react";
import { FiMenu } from "react-icons/fi";
import NotificationBell from "../admin/NotificationBell";
import GlobalSearch from "./GlobalSearch";
import OutletSwitcher from "../admin/OutletSwitcher";
import ProfileMenu from "./ProfileMenu";
import TodayControl from "./TodayControl";

const MobileAppHeader = ({ onMenuClick, sidebarOpen = false, sidebarId, title = "RestoSphere", subtitle = "Restaurant Management", settingsPath = "/dashboard/admin/settings" }) => {
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur-md sm:px-4">
      <div className="mx-auto flex min-w-0 max-w-7xl items-center justify-between gap-2">
        <button
          type="button"
          onClick={onMenuClick}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 lg:hidden"
          aria-label="Open menu"
          aria-expanded={sidebarOpen}
          aria-controls={sidebarId}
        >
          <FiMenu className="h-5 w-5" />
        </button>

        <div className="min-w-0 flex-1 text-center">
          <h1 className="truncate text-lg font-bold leading-tight text-slate-900">{title}</h1>
          <p className="truncate text-xs leading-tight text-slate-500 max-[359px]:hidden">{subtitle}</p>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <NotificationBell />
          <ProfileMenu compact settingsPath={settingsPath} />
        </div>
      </div>
      <div className="mt-2 min-w-0">
        <GlobalSearch className="w-full min-w-0" />
      </div>
      <div className="mt-2 flex min-w-0 gap-2">
        <OutletSwitcher className="min-w-0 flex-1" />
        <TodayControl className="min-w-0 flex-1 justify-between" />
      </div>
    </header>
  );
};

export default memo(MobileAppHeader);
