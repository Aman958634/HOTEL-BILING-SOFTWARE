import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import {
  FiBell,
  FiChevronDown,
  FiFilter,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
  FiCheckCircle,
  FiBookOpen,
  FiMail,
  FiDollarSign,
  FiShoppingBag,
  FiCreditCard,
  FiAlertCircle,
  FiUsers,
  FiXCircle,
  FiExternalLink,
} from "react-icons/fi";
import StatCard from "../../components/admin/StatCard";
import {
  deleteNotificationById,
  getNotificationSummary,
  getNotifications,
  markAllNotificationsRead,
  updateNotificationStatus,
} from "../../services/notificationService";

const defaultFilters = {
  search: "",
  type: "",
  status: "all",
  sortBy: "createdAt",
  sortOrder: "desc",
  page: 1,
  limit: 20,
};

const formatDateTime = (value) => {
  if (!value) return "Unknown";
  const date = new Date(value);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const statusOptions = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "read", label: "Read" },
];

const typeOptions = [
  { value: "", label: "All" },
  { value: "NEW_ORDER", label: "Orders" },
  { value: "PAYMENT_RECEIVED", label: "Payments" },
  { value: "ORDER_CANCELLED", label: "Order Cancellations" },
  { value: "SUBSCRIPTION_EXPIRING", label: "Subscription" },
  { value: "LOW_STOCK", label: "Inventory" },
  { value: "NEW_STAFF", label: "Staff" },
  { value: "order", label: "Order Status" },
  { value: "payment", label: "Payment Updates" },
  { value: "system", label: "System" },
];

const typeLabel = (type) => {
  switch (type) {
    case "NEW_ORDER":
      return "New Order";
    case "PAYMENT_RECEIVED":
      return "Payment Received";
    case "ORDER_CANCELLED":
      return "Order Cancelled";
    case "SUBSCRIPTION_EXPIRING":
      return "Subscription Expiring";
    case "LOW_STOCK":
      return "Low Stock";
    case "NEW_STAFF":
      return "New Staff";
    case "order":
      return "Order Status";
    case "payment":
      return "Payment Update";
    case "system":
      return "System";
    default:
      return String(type || "General").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
};

const typeBadgeClasses = (type) => {
  switch (type) {
    case "NEW_ORDER":
    case "order":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "PAYMENT_RECEIVED":
    case "payment":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "ORDER_CANCELLED":
      return "bg-rose-100 text-rose-700 border-rose-200";
    case "SUBSCRIPTION_EXPIRING":
      return "bg-orange-100 text-orange-700 border-orange-200";
    case "LOW_STOCK":
      return "bg-red-100 text-red-700 border-red-200";
    case "NEW_STAFF":
      return "bg-violet-100 text-violet-700 border-violet-200";
    case "system":
      return "bg-slate-100 text-slate-700 border-slate-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
};

const getNotificationLink = (notification) => {
  const { type } = notification;
  switch (type) {
    case "NEW_ORDER":
    case "ORDER_CANCELLED":
    case "order":
      return "/dashboard/admin/orders";
    case "PAYMENT_RECEIVED":
    case "payment":
      return "/dashboard/admin/payments";
    case "NEW_STAFF":
      return "/dashboard/admin/staff";
    case "SUBSCRIPTION_EXPIRING":
      return "/dashboard/admin/billing";
    case "LOW_STOCK":
      return "/dashboard/admin/menu";
    default:
      return null;
  }
};

const typeIconMap = {
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
  NEW_ORDER: "View Order",
  PAYMENT_RECEIVED: "View Payment",
  ORDER_CANCELLED: "View Order",
  NEW_STAFF: "View Staff",
  SUBSCRIPTION_EXPIRING: "View Plans",
  LOW_STOCK: "View Inventory",
  order: "View Order",
  payment: "View Payment",
};

const Notifications = () => {
  const [filters, setFilters] = useState(defaultFilters);
  const [notifications, setNotifications] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [summary, setSummary] = useState({ total: 0, unread: 0, newOrder: 0, paymentReceived: 0, orderCancelled: 0, subscriptionExpiring: 0, lowStock: 0, newStaff: 0, order: 0, payment: 0, system: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState(false);
  const filtersRef = useRef(filters);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const loadSummary = async () => {
    setLoadingSummary(true);
    setApiError(false);
    try {
      const { data } = await getNotificationSummary();
      setSummary(data.data || {});
    } catch (err) {
      setApiError(true);
      toast.error(err?.response?.data?.message || "Unable to load notification summary");
    } finally {
      setLoadingSummary(false);
    }
  };

  const loadNotifications = async (currentFilters = filtersRef.current) => {
    setLoading(true);
    setApiError(false);
    try {
      const params = {
        search: currentFilters.search || undefined,
        type: currentFilters.type || undefined,
        isRead: currentFilters.status === "read" ? true : currentFilters.status === "unread" ? false : undefined,
        page: currentFilters.page,
        limit: currentFilters.limit,
        sortBy: currentFilters.sortBy,
        sortOrder: currentFilters.sortOrder,
      };

      const { data } = await getNotifications(params);
      setNotifications(data.data || []);
      setMeta(data.meta || { total: 0, page: 1, limit: 20, totalPages: 1 });
    } catch (err) {
      setApiError(true);
      toast.error(err?.response?.data?.message || "Unable to load notifications");
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
    loadNotifications();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => loadNotifications(filters), 250);
    return () => clearTimeout(timeout);
  }, [filters]);

  const updateFilters = (patch) => {
    setFilters((current) => ({ ...current, ...patch, page: patch.page ? patch.page : current.page }));
  };

  const refreshPage = async () => {
    await Promise.all([loadSummary(), loadNotifications(filtersRef.current)]);
  };

  const handleMarkAllRead = async () => {
    setSaving(true);
    try {
      await markAllNotificationsRead();
      toast.success("All notifications marked as read");
      await refreshPage();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Unable to mark all notifications read");
    } finally {
      setSaving(false);
    }
  };

  const toggleReadStatus = async (notification) => {
    setSaving(true);
    try {
      await updateNotificationStatus(notification._id, !notification.isRead);
      toast.success(notification.isRead ? "Notification marked unread" : "Notification marked read");
      await refreshPage();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Unable to update notification");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (notification) => {
    const confirmed = window.confirm(`Delete notification “${notification.title}”?`);
    if (!confirmed) return;

    setSaving(true);
    try {
      await deleteNotificationById(notification._id);
      toast.success("Notification deleted");
      await refreshPage();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Unable to delete notification");
    } finally {
      setSaving(false);
    }
  };

  const pageCount = Math.min(meta.totalPages || 1, 5);

  const notificationRows = useMemo(
    () =>
      notifications.map((item) => {
        const link = getNotificationLink(item);
        const Icon = typeIconMap[item.type] || FiBell;
        const iconColor = typeIconColorMap[item.type] || "text-slate-600 bg-slate-50";
        const actionLabel = actionLabelMap[item.type];

        const content = (
          <article key={item._id} className={`rounded-2xl border p-4 transition-shadow hover:shadow-md ${item.isRead ? "border-slate-200 bg-white" : "border-brand-200 bg-brand-50/40"}`}>
            <div className="flex gap-4">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconColor}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${typeBadgeClasses(item.type)}`}>
                    {typeLabel(item.type)}
                  </span>
                  {!item.isRead && (
                    <span className="inline-flex h-2 w-2 rounded-full bg-brand-500" title="Unread" />
                  )}
                </div>
                <h3 className={`mt-2 truncate ${item.isRead ? "text-base font-medium text-slate-800" : "text-lg font-semibold text-slate-900"}`}>{item.title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">{item.message}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {link && actionLabel && (
                    <Link
                      to={link}
                      className="inline-flex items-center gap-1 rounded-xl border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-50"
                    >
                      {actionLabel}
                      <FiExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleReadStatus(item); }}
                    disabled={saving}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    {item.isRead ? "Mark unread" : "Mark read"}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDelete(item); }}
                    disabled={saving}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100 disabled:opacity-60"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 text-xs text-slate-500">
                <span className="whitespace-nowrap">{formatDateTime(item.createdAt)}</span>
              </div>
            </div>
          </article>
        );

        if (link && actionLabel) {
          return (
            <Link key={item._id} to={link} className="block">
              {content}
            </Link>
          );
        }

        return content;
      }),
    [notifications, saving]
  );

  return (
    <div className="space-y-4 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Notifications</h2>
          <p className="mt-1 text-sm text-slate-500">Manage restaurant alerts, order updates, and payment messages in one place.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={refreshPage}
            disabled={loading || loadingSummary || saving}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <FiRefreshCw /> Refresh
          </button>
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={summary.unread === 0 || saving}
            className="inline-flex items-center gap-2 rounded-2xl bg-brand-700 px-4 py-2 text-sm text-white transition hover:bg-brand-800 disabled:opacity-60"
          >
            <FiCheckCircle /> Mark all read
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Unread" value={summary.unread} icon={<FiBell />} />
        <StatCard label="Total" value={summary.total} icon={<FiMail />} />
        <StatCard label="Orders" value={summary.newOrder || summary.order} icon={<FiShoppingBag />} />
        <StatCard label="Payments" value={summary.paymentReceived || summary.payment} icon={<FiCreditCard />} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative w-full sm:w-64">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(event) => updateFilters({ search: event.target.value, page: 1 })}
                placeholder="Search notifications..."
                className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-4 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filters.type}
                onChange={(event) => updateFilters({ type: event.target.value, page: 1 })}
                className="rounded-xl border border-slate-300 bg-white py-2 pl-3 pr-8 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              >
                {typeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <select
                value={filters.status}
                onChange={(event) => updateFilters({ status: event.target.value, page: 1 })}
                className="rounded-xl border border-slate-300 bg-white py-2 pl-3 pr-8 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <FiFilter className="hidden sm:inline" />
              <span className="hidden sm:inline">Sorted by</span>
              <strong>{filters.sortBy === "createdAt" ? "Newest" : filters.sortBy}</strong>
            </div>
            <button
              type="button"
              onClick={() => updateFilters({ sortOrder: filters.sortOrder === "desc" ? "asc" : "desc" })}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              {filters.sortOrder === "desc" ? "Descending" : "Ascending"}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : apiError ? (
          <div className="rounded-2xl border border-dashed border-rose-300 bg-rose-50 p-10 text-center">
            <FiXCircle className="mx-auto h-8 w-8 text-rose-400" />
            <h3 className="mt-3 text-lg font-semibold text-slate-900">Unable to load notifications</h3>
            <p className="mt-2 text-sm text-slate-600">Something went wrong while loading your notifications.</p>
            <button
              type="button"
              onClick={refreshPage}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-sm text-white transition hover:bg-brand-800"
            >
              <FiRefreshCw /> Retry
            </button>
          </div>
        ) : notifications.length ? (
          notificationRows
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center sm:p-12">
            <FiBell className="mx-auto h-8 w-8 text-slate-400" />
            <h3 className="mt-4 text-lg font-semibold text-slate-900">
              {(filters.search || filters.type || filters.status !== "all") ? "No matching notifications" : "No notifications yet"}
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              {(filters.search || filters.type || filters.status !== "all")
                ? "Try changing your search or filters to find alerts and updates."
                : "You'll see important restaurant activity here."}
            </p>
          </div>
        )}
      </div>

      {!apiError && notifications.length > 0 && (meta.totalPages || 1) > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
          <p className="text-slate-600">
            Showing {(meta.page - 1) * meta.limit + (notifications.length ? 1 : 0)}-{(meta.page - 1) * meta.limit + notifications.length} of {meta.total} notifications
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => updateFilters({ page: Math.max(meta.page - 1, 1) })}
              disabled={meta.page <= 1}
              className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 disabled:opacity-60"
            >
              Previous
            </button>
            {Array.from({ length: pageCount }).map((_, index) => {
              const page = index + 1;
              return (
                <button
                  key={page}
                  type="button"
                  onClick={() => updateFilters({ page })}
                  className={`min-h-[44px] rounded-xl border px-4 py-2 text-sm ${page === meta.page ? "border-brand-700 bg-brand-700 text-white" : "border-slate-300 bg-white text-slate-700"}`}
                >
                  {page}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => updateFilters({ page: Math.min(meta.page + 1, meta.totalPages) })}
              disabled={meta.page >= meta.totalPages}
              className="min-h-[44px] rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 disabled:opacity-60"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Notifications;
