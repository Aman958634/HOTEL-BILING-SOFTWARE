import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FiBell, FiChevronRight, FiX } from "react-icons/fi";
import { getNotificationSummary, getNotifications, markAllNotificationsRead, updateNotificationStatus } from "../../services/notificationService";
import { useSocket } from "../../context/SocketContext";

const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState({ total: 0, unread: 0 });
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef(null);
  const socket = useSocket();

  const loadSummary = async () => {
    try {
      const { data } = await getNotificationSummary();
      setSummary(data.data || {});
    } catch {
      setSummary({ total: 0, unread: 0 });
    }
  };

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const { data } = await getNotifications({ page: 1, limit: 3, isRead: false, sortBy: "createdAt", sortOrder: "desc" });
      setNotifications(data.data || []);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const onNewNotification = () => {
      loadSummary();
      loadNotifications();
    };

    socket.on("notification:new", onNewNotification);
    return () => socket.off("notification:new", onNewNotification);
  }, [socket]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = async () => {
    setOpen((current) => !current);
    if (!open) {
      await loadNotifications();
      loadSummary();
    }
  };

  const toggleReadStatus = async (notification) => {
    try {
      await updateNotificationStatus(notification._id, !notification.isRead);
      await Promise.all([loadNotifications(), loadSummary()]);
    } catch {
      // ignore
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        className="relative rounded-xl border border-slate-300 p-2 text-slate-600 transition hover:bg-slate-50"
      >
        <FiBell />
        {summary.unread > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
            {summary.unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[320px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Notifications</p>
              <p className="text-xs text-slate-500">{summary.unread} unread • {summary.total} total</p>
            </div>
            <button aria-label="Close" type="button" onClick={() => setOpen(false)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
              <FiX />
            </button>
          </div>

          <div className="space-y-2 px-3 py-3">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
                ))}
              </div>
            ) : notifications.length ? (
              notifications.map((item) => (
                <div key={item._id} className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-600 truncate">{item.message}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleReadStatus(item)}
                      className="rounded-full border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold uppercase text-slate-700"
                    >
                      {item.isRead ? "Unread" : "Read"}
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                    <span>{new Date(item.createdAt).toLocaleString()}</span>
                    <span className="rounded-full border border-slate-200 px-2 py-0.5 text-slate-700">{item.type || "General"}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-sm text-slate-500">
                <FiBell className="h-6 w-6 text-slate-300" aria-hidden="true" />
                <span>No recent notifications</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
            <Link
              to="/dashboard/admin/notifications"
              className="inline-flex flex-1 items-center justify-between rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100"
              onClick={() => setOpen(false)}
            >
              View all
              <FiChevronRight />
            </Link>
            <button
              type="button"
              onClick={async () => {
                await markAllNotificationsRead();
                await Promise.all([loadSummary(), loadNotifications()]);
              }}
              className="rounded-2xl bg-brand-700 px-4 py-2 text-sm text-white transition hover:bg-brand-800"
            >
              Mark all read
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
