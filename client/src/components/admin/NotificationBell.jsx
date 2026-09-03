import { memo, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { FiBell, FiChevronRight, FiX, FiShoppingBag, FiCreditCard, FiUsers, FiDollarSign, FiAlertCircle, FiExternalLink, FiXCircle } from "react-icons/fi";
import { getNotificationSummary, getNotifications, markAllNotificationsRead, updateNotificationStatus } from "../../services/notificationService";
import { useSocket } from "../../context/SocketContext";

const getNotificationLink = (notification) => {
  if (notification?.route) return notification.route;
  const type = typeof notification === "string" ? notification : notification?.type;
  switch (type) {
    case "ORDER_CREATED":
    case "NEW_ORDER":
    case "ORDER_CANCELLED":
    case "order":
      return "/dashboard/admin/orders";
    case "ONLINE_ORDER_RECEIVED":
      return "/dashboard/admin/online-orders";
    case "KOT_CREATED":
    case "KOT_READY":
      return "/dashboard/admin/kitchen";
    case "CUSTOMER_CREATED":
      return "/dashboard/admin/customers";
    case "STAFF_CREATED":
      return "/dashboard/admin/staff";
    case "PAYMENT_RECEIVED":
    case "payment":
      return "/dashboard/admin/payments";
    case "NEW_STAFF":
      return "/dashboard/admin/staff";
    case "BILL_GENERATED":
    case "PARTIAL_PAYMENT_RECEIVED":
    case "BILL_FULLY_PAID":
    case "REFUND_CREATED":
    case "REFUND_COMPLETED":
    case "RECONCILIATION_MISMATCH":
      return "/dashboard/admin/payments";
    case "LOYALTY_MEMBER_ENROLLED":
      return "/dashboard/admin/loyalty";
    case "SUBSCRIPTION_EXPIRING":
      return "/dashboard/admin/billing";
    case "INVENTORY_LOW":
    case "INVENTORY_OUT_OF_STOCK":
    case "LOW_STOCK":
      return "/dashboard/admin/inventory";
    case "INTELLIGENCE_ALERT_CREATED":
      return "/dashboard/admin/intelligence";
    default:
      return null;
  }
};

const typeIconMap = {
  ORDER_CREATED: FiShoppingBag,
  ONLINE_ORDER_RECEIVED: FiShoppingBag,
  KOT_CREATED: FiShoppingBag,
  KOT_READY: FiShoppingBag,
  CUSTOMER_CREATED: FiUsers,
  STAFF_CREATED: FiUsers,
  BILL_GENERATED: FiDollarSign,
  PARTIAL_PAYMENT_RECEIVED: FiCreditCard,
  BILL_FULLY_PAID: FiCreditCard,
  REFUND_CREATED: FiXCircle,
  REFUND_COMPLETED: FiCreditCard,
  LOYALTY_MEMBER_ENROLLED: FiUsers,
  INVENTORY_LOW: FiAlertCircle,
  INVENTORY_OUT_OF_STOCK: FiAlertCircle,
  RECONCILIATION_MISMATCH: FiAlertCircle,
  INTELLIGENCE_ALERT_CREATED: FiAlertCircle,
  NEW_ORDER: FiShoppingBag,
  PAYMENT_RECEIVED: FiCreditCard,
  ORDER_CANCELLED: FiXCircle,
  SUBSCRIPTION_EXPIRING: FiDollarSign,
  LOW_STOCK: FiAlertCircle,
  NEW_STAFF: FiUsers,
  order: FiShoppingBag,
  payment: FiCreditCard,
  system: FiBell,
};

const typeIconColorMap = {
  NEW_ORDER: "text-amber-600 bg-amber-50",
  PAYMENT_RECEIVED: "text-emerald-600 bg-emerald-50",
  ORDER_CANCELLED: "text-rose-600 bg-rose-50",
  SUBSCRIPTION_EXPIRING: "text-orange-600 bg-orange-50",
  LOW_STOCK: "text-red-600 bg-red-50",
  NEW_STAFF: "text-violet-600 bg-violet-50",
  order: "text-amber-600 bg-amber-50",
  payment: "text-emerald-600 bg-emerald-50",
  system: "text-slate-600 bg-slate-50",
};

const actionLabelMap = {
  ORDER_CREATED: "View Orders",
  ONLINE_ORDER_RECEIVED: "View Online Orders",
  KOT_CREATED: "View Kitchen",
  KOT_READY: "View Kitchen",
  CUSTOMER_CREATED: "View Customers",
  STAFF_CREATED: "View Staff",
  BILL_GENERATED: "View Billing",
  PARTIAL_PAYMENT_RECEIVED: "View Billing",
  BILL_FULLY_PAID: "View Billing",
  REFUND_CREATED: "View Reconciliation",
  REFUND_COMPLETED: "View Reconciliation",
  LOYALTY_MEMBER_ENROLLED: "View Loyalty",
  INVENTORY_LOW: "View Inventory",
  INVENTORY_OUT_OF_STOCK: "View Inventory",
  RECONCILIATION_MISMATCH: "View Reconciliation",
  INTELLIGENCE_ALERT_CREATED: "View Intelligence",
  NEW_ORDER: "View Order",
  PAYMENT_RECEIVED: "View Payment",
  ORDER_CANCELLED: "View Order",
  NEW_STAFF: "View Staff",
  SUBSCRIPTION_EXPIRING: "View Plans",
  LOW_STOCK: "View Inventory",
  order: "View Order",
  payment: "View Payment",
};

const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState({ total: 0, unread: 0 });
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
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
    setError("");
    try {
      const { data } = await getNotifications({ page: 1, limit: 3, isRead: false, sortBy: "createdAt", sortOrder: "desc" });
      setNotifications(data.data || []);
    } catch {
      setNotifications([]);
      setError("Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  useEffect(() => {
    if (!socket) return;

    const onNewNotification = (notification) => {
      if (!notification?.id && !notification?.notificationId) return;
      const id = notification.id || notification.notificationId;
      setNotifications((current) => {
        if (current.some((item) => String(item._id || item.id) === String(id))) return current;
        return [{ ...notification, _id: id, isRead: Boolean(notification.isRead) }, ...current].slice(0, 3);
      });
      setSummary((current) => ({ ...current, total: Number(current.total || 0) + 1, unread: Number(current.unread || 0) + (notification.isRead ? 0 : 1) }));
      // REST remains canonical after reconnect/reload; defer avoids duplicate UI races.
      window.setTimeout(() => { loadSummary(); loadNotifications(); }, 250);
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
    if (saving) return;
    setSaving(true);
    try {
      await updateNotificationStatus(notification._id, !notification.isRead);
      await Promise.all([loadNotifications(), loadSummary()]);
    } catch {
      toast.error("Unable to update notification");
    } finally {
      setSaving(false);
    }
  };

  const handleMarkAllRead = async () => {
    if (!summary.unread || saving) return;
    setSaving(true);
    try {
      await markAllNotificationsRead();
      await Promise.all([loadSummary(), loadNotifications()]);
    } catch {
      toast.error("Unable to mark notifications as read");
    } finally {
      setSaving(false);
    }
  };

  const unreadLabel = summary.unread > 99 ? "99+" : summary.unread;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Open notifications"
        aria-expanded={open}
        aria-haspopup="menu"
        className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-300 text-slate-600 transition hover:bg-slate-50"
      >
        <FiBell />
        {summary.unread > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">
            {unreadLabel}
          </span>
        )}
      </button>

      {open && (
        <div role="menu" aria-label="Notifications" className="fixed left-3 right-3 top-16 z-50 flex max-h-[calc(100dvh-5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-full sm:max-h-[min(34rem,calc(100dvh-6rem))] sm:w-96">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Notifications</p>
              <p className="text-xs text-slate-500">{summary.unread} unread • {summary.total} total</p>
            </div>
            <button aria-label="Close" type="button" onClick={() => setOpen(false)} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
              <FiX />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
                ))}
              </div>
            ) : error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><p>{error}</p><button type="button" onClick={loadNotifications} className="mt-2 font-semibold">Retry</button></div> : notifications.length ? (
              notifications.map((item) => {
                const link = getNotificationLink(item);
                const Icon = typeIconMap[item.type] || FiBell;
                const iconColor = typeIconColorMap[item.type] || "text-slate-600 bg-slate-50";
                const actionLabel = actionLabelMap[item.type];

                const content = (
                  <div key={item._id} className={`rounded-xl border p-3 ${item.isRead ? "border-slate-200 bg-white" : "border-brand-200 bg-brand-50/40"}`}>
                    <div className="flex items-start gap-3">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconColor}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-900 truncate">{item.title}</p>
                          {!item.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-brand-500" title="Unread" />}
                        </div>
                        <p className="mt-1 break-words text-xs leading-5 text-slate-600">{item.message}</p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="text-[11px] text-slate-500">{new Date(item.createdAt).toLocaleString()}</span>
                          <div className="flex items-center gap-1.5">
                            {link && actionLabel && (
                              <Link
                                to={link}
                                onClick={(e) => { e.stopPropagation(); setOpen(false); }}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-800"
                              >
                                {actionLabel}
                                <FiExternalLink className="h-3 w-3" />
                              </Link>
                            )}
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); toggleReadStatus(item); }}
                              disabled={saving}
                              className="text-[11px] font-medium text-slate-600 hover:text-slate-800"
                            >
                              {item.isRead ? "Unread" : "Read"}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );

                return content;
              })
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
              onClick={handleMarkAllRead}
              disabled={!summary.unread || saving}
              className="min-h-10 rounded-xl bg-brand-700 px-3 text-sm text-white transition hover:bg-brand-800 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Mark all read"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(NotificationBell);
