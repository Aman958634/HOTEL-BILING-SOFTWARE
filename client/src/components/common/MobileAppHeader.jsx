import { FiMenu, FiUser } from "react-icons/fi";
import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import NotificationBell from "../admin/NotificationBell";
import { getNotificationSummary } from "../../services/notificationService";

const MobileAppHeader = ({ onMenuClick, notificationCount }) => {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchNotificationSummary = async () => {
      try {
        const { data } = await getNotificationSummary();
        setUnreadCount(data.data?.unread || 0);
      } catch {
        setUnreadCount(0);
      }
    };

    fetchNotificationSummary();
  }, []);

  const displayCount = notificationCount !== undefined ? notificationCount : unreadCount;

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
          <div className="relative">
            <NotificationBell />
            {displayCount > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
                {displayCount > 99 ? "99+" : displayCount}
              </span>
            )}
          </div>
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
