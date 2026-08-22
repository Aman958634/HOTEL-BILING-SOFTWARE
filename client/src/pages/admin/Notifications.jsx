import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
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
  limit: 10,
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
  { value: "order", label: "Order" },
  { value: "payment", label: "Payment" },
  { value: "reservation", label: "Reservation" },
  { value: "system", label: "System" },
];

const typeLabel = (type) => {
  switch (type) {
    case "order":
      return "Order";
    case "payment":
      return "Payment";
    case "reservation":
      return "Reservation";
    case "system":
      return "System";
    default:
      return "General";
  }
};

const typeBadgeClasses = (type) => {
  switch (type) {
    case "order":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "payment":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "reservation":
      return "bg-sky-100 text-sky-700 border-sky-200";
    case "system":
      return "bg-slate-100 text-slate-700 border-slate-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
};

const Notifications = () => {
  const [filters, setFilters] = useState(defaultFilters);
  const [notifications, setNotifications] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [summary, setSummary] = useState({ total: 0, unread: 0, order: 0, payment: 0, reservation: 0, system: 0 });
  const [loading, setLoading] = useState(true);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [saving, setSaving] = useState(false);
  const filtersRef = useRef(filters);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const loadSummary = async () => {
    setLoadingSummary(true);
    try {
      const { data } = await getNotificationSummary();
      setSummary(data.data || {});
    } catch (err) {
      toast.error(err?.response?.data?.message || "Unable to load notification summary");
    } finally {
      setLoadingSummary(false);
    }
  };

  const loadNotifications = async (currentFilters = filtersRef.current) => {
    setLoading(true);
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
      setMeta(data.meta || { total: 0, page: 1, limit: 10, totalPages: 1 });
    } catch (err) {
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
      notifications.map((item) => (
        <article key={item._id} className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${typeBadgeClasses(item.type)}`}>
                  {typeLabel(item.type)}
                </span>
                <span>{item.user?.fullName || item.user?.email || "System"}</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600">
                  {item.isRead ? "Read" : "Unread"}
                </span>
              </div>
              <h3 className="mt-3 text-lg font-semibold text-slate-900 truncate">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.message}</p>
            </div>
            <div className="flex flex-col gap-2 text-sm text-slate-500 md:items-end">
              <span>{formatDateTime(item.createdAt)}</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => toggleReadStatus(item)}
                  disabled={saving}
                  className="rounded-full border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  {item.isRead ? "Mark unread" : "Mark read"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(item)}
                  disabled={saving}
                  className="rounded-full border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </article>
      )),
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
            disabled={loading || loadingSummary}
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
        <StatCard label="Orders" value={summary.order} icon={<FiShoppingBag />} />
        <StatCard label="Payments" value={summary.payment} icon={<FiCreditCard />} />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(event) => updateFilters({ search: event.target.value, page: 1 })}
                placeholder="Search notifications"
                className="w-full rounded-2xl border border-slate-300 bg-white py-2 pl-10 pr-4 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 sm:w-72"
              />
            </div>
            <select
              value={filters.type}
              onChange={(event) => updateFilters({ type: event.target.value, page: 1 })}
              className="rounded-2xl border border-slate-300 bg-white py-2 px-4 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            >
              {typeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select
              value={filters.status}
              onChange={(event) => updateFilters({ status: event.target.value, page: 1 })}
              className="rounded-2xl border border-slate-300 bg-white py-2 px-4 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <FiFilter /> Sorted by
              <strong>{filters.sortBy === "createdAt" ? "Newest" : filters.sortBy}</strong>
            </div>
            <button
              type="button"
              onClick={() => updateFilters({ sortOrder: filters.sortOrder === "desc" ? "asc" : "desc" })}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              {filters.sortOrder === "desc" ? "Descending" : "Ascending"}
            </button>
            <select
              value={filters.limit}
              onChange={(event) => updateFilters({ limit: Number(event.target.value), page: 1 })}
              className="rounded-2xl border border-slate-300 bg-white py-2 px-4 text-sm text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            >
              {[10, 20, 30].map((limit) => (
                <option key={limit} value={limit}>{limit} per page</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="grid gap-4">
            {Array.from({ length: filters.limit }).map((_, index) => (
              <div key={index} className="h-32 animate-pulse rounded-3xl bg-slate-100" />
            ))}
          </div>
        ) : notificationRows.length ? (
          notificationRows
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center text-slate-600 shadow-sm">
            <FiBookOpen className="mx-auto h-8 w-8 text-slate-400" />
            <h2 className="mt-4 text-lg font-semibold text-slate-900">No notifications found</h2>
            <p className="mt-2 text-sm">Try a different search term or filter scope to find alerts and updates.</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
        <p className="text-slate-600">
          Showing {(meta.page - 1) * meta.limit + (notifications.length ? 1 : 0)}-{(meta.page - 1) * meta.limit + notifications.length} of {meta.total} notifications
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => updateFilters({ page: Math.max(meta.page - 1, 1) })}
            disabled={meta.page <= 1}
            className="min-h-[44px] rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 disabled:opacity-60"
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
                className={`min-h-[44px] rounded-2xl border px-4 py-2 text-sm ${page === meta.page ? "border-brand-700 bg-brand-700 text-white" : "border-slate-300 bg-white text-slate-700"}`}
              >
                {page}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => updateFilters({ page: Math.min(meta.page + 1, meta.totalPages) })}
            disabled={meta.page >= meta.totalPages}
            className="min-h-[44px] rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 disabled:opacity-60"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default Notifications;
