import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FiFileText, FiRefreshCw, FiSearch, FiTrash2, FiX } from "react-icons/fi";
import {
  deleteSaasPayment,
  downloadSaasPaymentPdf,
  fetchSaasPaymentById,
  fetchSaasPaymentSummary,
  fetchSaasPayments,
} from "../../services/superAdminService";

const formatMoney = (amount, currency = "INR") => {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
      maximumFractionDigits: 0,
    }).format(Number(amount) || 0);
  } catch {
    return `₹${Number(amount) || 0}`;
  }
};

const formatDate = (value) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
};

const statusBadgeClass = {
  SUCCESS: "bg-emerald-100 text-emerald-800 border-emerald-200",
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  FAILED: "bg-rose-100 text-rose-800 border-rose-200",
  REFUNDED: "bg-slate-200 text-slate-700 border-slate-300",
  CANCELLED: "bg-slate-100 text-slate-600 border-slate-200",
};

const PaymentStatusBadge = ({ status }) => {
  const key = String(status || "").toUpperCase();
  return (
    <span
      className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${
        statusBadgeClass[key] || statusBadgeClass.CANCELLED
      }`}
    >
      {key || "—"}
    </span>
  );
};

const SummaryCard = ({ label, value, accent }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
    <p className={`mt-2 text-2xl font-bold ${accent || "text-slate-900"}`}>{value}</p>
  </div>
);

const emptyFilters = {
  q: "",
  status: "all",
  plan: "all",
  method: "all",
  dateRange: "all",
  from: "",
  to: "",
};

const ConfirmModal = ({ open, title, message, confirmLabel, onConfirm, onCancel, busy }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:opacity-60"
          >
            {busy ? "Deleting..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

const PaymentDetailsModal = ({ open, payment, loading, onClose }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Payment Details</h3>
            <p className="mt-1 text-sm text-slate-500">Safe payment information only</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
            aria-label="Close"
          >
            <FiX />
          </button>
        </div>

        {loading && (
          <div className="mt-8 flex justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
          </div>
        )}

        {!loading && payment && (
          <dl className="mt-6 space-y-3 text-sm">
            {[
              ["Payment ID", payment.razorpayPaymentId || payment.paymentId],
              ["Razorpay Order ID", payment.razorpayOrderId || "—"],
              ["Restaurant", payment.restaurantName],
              ["Customer", payment.customerName],
              ["Customer Email", payment.customer?.email || "—"],
              ["Plan", payment.plan],
              ["Amount", formatMoney(payment.amount, payment.currency)],
              ["Currency", payment.currency || "INR"],
              ["Payment Method", payment.paymentMethod],
              ["Payment Status", payment.status],
              ["Payment Date", formatDate(payment.paymentDate)],
              ["Subscription ID", payment.subscriptionId ? String(payment.subscriptionId) : "—"],
              ["Gateway", payment.gateway || "—"],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-3 gap-2 border-b border-slate-100 pb-2">
                <dt className="col-span-1 text-slate-500">{label}</dt>
                <dd className="col-span-2 break-all font-medium text-slate-900">
                  {label === "Payment Status" ? <PaymentStatusBadge status={value} /> : value || "—"}
                </dd>
              </div>
            ))}
          </dl>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const SuperAdminPaymentsPage = () => {
  const [filters, setFilters] = useState(emptyFilters);
  const [draftQ, setDraftQ] = useState("");
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [pdfBusyId, setPdfBusyId] = useState("");

  const queryParams = useMemo(() => {
    const params = {
      page: meta.page,
      limit: meta.limit,
    };
    if (filters.q.trim()) params.q = filters.q.trim();
    if (filters.status !== "all") params.status = filters.status;
    if (filters.plan !== "all") params.plan = filters.plan;
    if (filters.method !== "all") params.method = filters.method;
    if (filters.dateRange !== "all") params.dateRange = filters.dateRange;
    if (filters.dateRange === "custom") {
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;
    }
    return params;
  }, [filters, meta.page, meta.limit]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [listRes, summaryRes] = await Promise.all([
        fetchSaasPayments(queryParams),
        fetchSaasPaymentSummary(),
      ]);
      const payload = listRes.data?.data || {};
      setItems(payload.items || []);
      setSummary(summaryRes.data?.data || payload.summary || null);
      setMeta((prev) => ({
        ...prev,
        ...(payload.meta || {}),
        limit: payload.meta?.limit || prev.limit,
      }));
    } catch (_err) {
      setItems([]);
      setSummary(null);
      setError("Unable to load payments. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  useEffect(() => {
    load();
  }, [load]);

  const updateFilter = (key, value) => {
    setMeta((prev) => ({ ...prev, page: 1 }));
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const applySearch = () => {
    setMeta((prev) => ({ ...prev, page: 1 }));
    setFilters((prev) => ({ ...prev, q: draftQ }));
  };

  const clearFilters = () => {
    setDraftQ("");
    setFilters(emptyFilters);
    setMeta((prev) => ({ ...prev, page: 1 }));
  };

  const openDetails = async (row) => {
    setDetailsOpen(true);
    setSelected(row);
    setDetailsLoading(true);
    try {
      const { data } = await fetchSaasPaymentById(row._id || row.id);
      setSelected(data?.data || row);
    } catch (_err) {
      toast.error("Unable to load payment details");
    } finally {
      setDetailsLoading(false);
    }
  };

  const downloadPdf = async (row) => {
    const id = row._id || row.id;
    if (!id) {
      toast.error("Payment ID missing");
      return;
    }
    setPdfBusyId(id);
    try {
      const { data } = await downloadSaasPaymentPdf(id);
      const paymentId = row.razorpayPaymentId || row.paymentId || id;
      const safeName = String(paymentId).replace(/[^a-zA-Z0-9_-]/g, "_");
      const blob = new Blob([data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `RestoSphere-Payment-${safeName}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Payment receipt downloaded");
    } catch (_err) {
      toast.error("Unable to generate payment PDF");
    } finally {
      setPdfBusyId("");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget._id || deleteTarget.id;
    setDeleteBusy(true);
    try {
      await deleteSaasPayment(id);
      toast.success("Payment deleted successfully");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Unable to delete payment");
    } finally {
      setDeleteBusy(false);
    }
  };

  const pageNumbers = useMemo(() => {
    const totalPages = meta.totalPages || 1;
    const current = meta.page || 1;
    const pages = [];
    const start = Math.max(1, current - 2);
    const end = Math.min(totalPages, start + 4);
    for (let i = start; i <= end; i += 1) pages.push(i);
    return pages;
  }, [meta.page, meta.totalPages]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Payments</h2>
          <p className="text-sm text-slate-500">
            SaaS subscription payments from Razorpay. Successful plan upgrades appear here automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <FiRefreshCw className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Total Payments" value={summary?.totalPayments ?? (loading ? "…" : 0)} />
        <SummaryCard
          label="Successful"
          value={summary?.successfulPayments ?? (loading ? "…" : 0)}
          accent="text-emerald-700"
        />
        <SummaryCard
          label="Pending"
          value={summary?.pendingPayments ?? (loading ? "…" : 0)}
          accent="text-amber-700"
        />
        <SummaryCard
          label="Failed"
          value={summary?.failedPayments ?? (loading ? "…" : 0)}
          accent="text-rose-700"
        />
        <SummaryCard
          label="Total Revenue"
          value={summary ? formatMoney(summary.totalRevenue) : loading ? "…" : "₹0"}
          accent="text-teal-800"
        />
      </div>

      <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-6">
          <div className="relative lg:col-span-2">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={draftQ}
              onChange={(e) => setDraftQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
              placeholder="Search payment ID, order ID, restaurant, customer, plan"
              className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm"
            />
          </div>
          <select
            value={filters.status}
            onChange={(e) => updateFilter("status", e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="all">Status: All</option>
            <option value="success">Success</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
          <select
            value={filters.plan}
            onChange={(e) => updateFilter("plan", e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="all">Plan: All</option>
            <option value="basic">Basic</option>
            <option value="pro">Pro</option>
            <option value="premium">Premium</option>
          </select>
          <select
            value={filters.method}
            onChange={(e) => updateFilter("method", e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="all">Method: All</option>
            <option value="card">Card</option>
            <option value="upi">UPI</option>
            <option value="netbanking">Netbanking</option>
            <option value="wallet">Wallet</option>
          </select>
          <select
            value={filters.dateRange}
            onChange={(e) => updateFilter("dateRange", e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="all">Date: All</option>
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="custom">Custom range</option>
          </select>
        </div>

        {filters.dateRange === "custom" && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              type="date"
              value={filters.from}
              onChange={(e) => updateFilter("from", e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={filters.to}
              onChange={(e) => updateFilter("to", e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={applySearch}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
          >
            Search
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Clear filters
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-center">
          <p className="font-semibold text-rose-800">{error}</p>
          <button
            type="button"
            onClick={load}
            className="mt-3 rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800"
          >
            Retry
          </button>
        </div>
      )}

      {!error && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3">Payment ID</th>
                <th className="px-4 py-3">Restaurant / Hotel</th>
                <th className="px-4 py-3">Customer / User</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Currency</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Order ID</th>
                <th className="px-4 py-3">Payment Date</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading &&
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={`sk-${idx}`} className="border-t border-slate-100">
                    {Array.from({ length: 11 }).map((__, cell) => (
                      <td key={cell} className="px-4 py-3">
                        <div className="h-4 animate-pulse rounded bg-slate-100" />
                      </td>
                    ))}
                  </tr>
                ))}

              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-12 text-center">
                    <p className="text-lg font-semibold text-slate-900">No payments found</p>
                    <p className="mt-1 text-sm text-slate-500">
                      Successful subscription payments will appear here.
                    </p>
                  </td>
                </tr>
              )}

              {!loading &&
                items.map((p) => (
                  <tr key={p._id || p.id} className="border-t border-slate-100 align-top hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-mono text-xs text-slate-800">
                      {p.razorpayPaymentId || p.paymentId || "—"}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">{p.restaurantName || "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{p.customerName || "—"}</td>
                    <td className="px-4 py-3">{p.plan || "—"}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {formatMoney(p.amount, p.currency)}
                    </td>
                    <td className="px-4 py-3">{p.currency || "INR"}</td>
                    <td className="px-4 py-3">{p.paymentMethod || "—"}</td>
                    <td className="px-4 py-3">
                      <PaymentStatusBadge status={p.status} />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">
                      {p.razorpayOrderId || "—"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{formatDate(p.paymentDate)}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          onClick={() => openDetails(p)}
                          className="rounded border border-teal-300 bg-teal-50 px-2 py-1 text-xs font-medium text-teal-900 hover:bg-teal-100"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          disabled={pdfBusyId === (p._id || p.id)}
                          onClick={() => downloadPdf(p)}
                          className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                          title="Download PDF receipt"
                        >
                          <FiFileText className="text-sm" />
                          {pdfBusyId === (p._id || p.id) ? "..." : "PDF"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(p)}
                          className="inline-flex items-center gap-1 rounded border border-rose-300 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-800 hover:bg-rose-100"
                          title="Delete payment"
                        >
                          <FiTrash2 className="text-sm" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>

          {!loading && meta.totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
              <p className="text-xs text-slate-500">
                Showing {(meta.page - 1) * meta.limit + (meta.total ? 1 : 0)}–
                {Math.min(meta.page * meta.limit, meta.total)} of {meta.total}
              </p>
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  disabled={meta.page <= 1}
                  onClick={() => setMeta((prev) => ({ ...prev, page: prev.page - 1 }))}
                  className="rounded border border-slate-300 px-3 py-1 text-xs disabled:opacity-40"
                >
                  Previous
                </button>
                {pageNumbers.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setMeta((prev) => ({ ...prev, page: n }))}
                    className={`rounded px-3 py-1 text-xs ${
                      n === meta.page
                        ? "bg-teal-700 text-white"
                        : "border border-slate-300 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={meta.page >= meta.totalPages}
                  onClick={() => setMeta((prev) => ({ ...prev, page: prev.page + 1 }))}
                  className="rounded border border-slate-300 px-3 py-1 text-xs disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <PaymentDetailsModal
        open={detailsOpen}
        payment={selected}
        loading={detailsLoading}
        onClose={() => {
          setDetailsOpen(false);
          setSelected(null);
        }}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Payment"
        message="Are you sure you want to delete this payment?"
        confirmLabel="Delete"
        busy={deleteBusy}
        onCancel={() => !deleteBusy && setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
};

export default SuperAdminPaymentsPage;
