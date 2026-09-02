import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { FiAlertTriangle, FiFilter, FiRefreshCw } from "react-icons/fi";
import PaymentStats from "../../components/payments/PaymentStats";
import AdvancedBillingWorkspace from "../../components/payments/AdvancedBillingWorkspace";
import ReconciliationWorkspace from "../../components/payments/ReconciliationWorkspace";
import PaymentFilters from "../../components/payments/PaymentFilters";
import PaymentTable from "../../components/payments/PaymentTable";
import { useSocket } from "../../context/SocketContext";
import { deletePayment, exportPayments, getPaymentById, getPaymentReceipt, getPayments, getPaymentStats, reconcilePayment, refundPayment } from "../../services/paymentService";
import { formatCurrency, getPaymentAmount, paymentMethodLabel, paymentStatusLabel } from "../../utils/paymentUtils";

const PaymentAnalytics = lazy(() => import("../../components/payments/PaymentAnalytics"));
const PaymentDetailsDrawer = lazy(() => import("../../components/payments/PaymentDetailsDrawer"));
const PaymentReceipt = lazy(() => import("../../components/payments/PaymentReceipt"));
const RefundModal = lazy(() => import("../../components/payments/RefundModal"));
const ConfirmDialog = lazy(() => import("../../components/admin/ConfirmDialog"));

const defaultFilters = {
  search: "",
  range: "",
  status: "",
  method: "",
  startDate: "",
  endDate: "",
  page: 1,
  limit: 10,
  sortBy: "createdAt",
  sortOrder: "desc",
};

const Payments = () => {
  const [filters, setFilters] = useState(defaultFilters);
  const [stats, setStats] = useState(null);
  const [payments, setPayments] = useState([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(true);
  const [error, setError] = useState("");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundTarget, setRefundTarget] = useState(null);
  const [processingRefund, setProcessingRefund] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletingPayment, setDeletingPayment] = useState(false);
  const [reconciliationRefreshVersion, setReconciliationRefreshVersion] = useState(0);

  const socket = useSocket();
  const filtersRef = useRef(filters);
  const paymentRefreshPromise = useRef(null);
  const socketRefreshTimer = useRef(null);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const updateFilters = useCallback((patch) => {
    setFilters((current) => ({ ...current, ...patch }));
  }, []);

  const loadStats = useCallback(async (range = filtersRef.current.range) => {
    setLoadingStats(true);
    try {
      const { data } = await getPaymentStats(range ? { range } : {});
      setStats(data.data || null);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Unable to load payment stats");
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const loadPayments = useCallback(async (currentFilters = filtersRef.current) => {
    setLoadingPayments(true);
    setError("");
    try {
      const params = {
        search: currentFilters.search || undefined,
        range: currentFilters.range || undefined,
        status: currentFilters.status || undefined,
        method: currentFilters.method || undefined,
        startDate: currentFilters.range === "custom" ? currentFilters.startDate || undefined : undefined,
        endDate: currentFilters.range === "custom" ? currentFilters.endDate || undefined : undefined,
        page: currentFilters.page,
        limit: currentFilters.limit,
        sortBy: currentFilters.sortBy,
        sortOrder: currentFilters.sortOrder,
      };

      const { data } = await getPayments(params);
      setPayments(data.data || []);
      setMeta(data.meta || { total: 0, page: 1, limit: 10, totalPages: 1 });
    } catch (err) {
      const message = err?.response?.data?.message || "Unable to load payments";
      setError(message);
      setPayments([]);
      toast.error(message);
    } finally {
      setLoadingPayments(false);
    }
  }, []);

  // The payment ledger endpoint remains authoritative. Re-fetch instead of
  // adding a local row because the active filters or page may exclude it.
  const refreshPaymentData = useCallback(() => {
    if (paymentRefreshPromise.current) return paymentRefreshPromise.current;

    const request = Promise.all([
      loadPayments(filtersRef.current),
      loadStats(filtersRef.current.range),
    ]).finally(() => {
      if (paymentRefreshPromise.current === request) paymentRefreshPromise.current = null;
    });
    paymentRefreshPromise.current = request;
    return request;
  }, [loadPayments, loadStats]);

  const refreshPaymentWorkspace = useCallback(async () => {
    if (socketRefreshTimer.current) {
      clearTimeout(socketRefreshTimer.current);
      socketRefreshTimer.current = null;
    }
    setReconciliationRefreshVersion((current) => current + 1);
    await refreshPaymentData();
  }, [refreshPaymentData]);

  const prevRange = useRef(filters.range);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    const rangeChanged = prevRange.current !== filters.range;
    prevRange.current = filters.range;

    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      loadPayments(filtersRef.current);
      loadStats(filtersRef.current.range);
      return;
    }

    const timeoutId = setTimeout(() => {
      loadPayments(filters);
      if (rangeChanged) loadStats(filters.range);
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [filters, loadPayments, loadStats]);

  useEffect(() => {
    if (!socket) return;

    const refresh = () => {
      // Local mutations refresh immediately; this brief delay lets that
      // request win and combines a burst of socket events into one refresh.
      if (socketRefreshTimer.current) return;
      socketRefreshTimer.current = setTimeout(() => {
        socketRefreshTimer.current = null;
        void refreshPaymentWorkspace();
      }, 150);
    };

    socket.on("payment:created", refresh);
    socket.on("payment:updated", refresh);
    socket.on("payment:refunded", refresh);

    return () => {
      socket.off("payment:created", refresh);
      socket.off("payment:updated", refresh);
      socket.off("payment:refunded", refresh);
    };
  }, [socket, refreshPaymentWorkspace]);

  useEffect(() => () => {
    if (socketRefreshTimer.current) clearTimeout(socketRefreshTimer.current);
  }, []);

  const openDetails = async (payment) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const { data } = await getPaymentById(payment._id || payment.paymentId);
      setSelectedPayment(data.data);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Unable to load payment details");
      setSelectedPayment(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const openReceipt = async (payment) => {
    try {
      if (!selectedPayment || selectedPayment.paymentId !== payment.paymentId) {
        const { data } = await getPaymentById(payment._id || payment.paymentId);
        setSelectedPayment(data.data);
      }
      setReceiptOpen(true);
      setDetailOpen(false);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Unable to load receipt");
    }
  };

  const downloadReceipt = async () => {
    if (!selectedPayment) return;
    try {
      const { data } = await getPaymentReceipt(selectedPayment._id || selectedPayment.paymentId);
      const url = URL.createObjectURL(data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `receipt-${selectedPayment.paymentId}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("Receipt downloaded");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Unable to download receipt");
    }
  };

  const printReceipt = () => {
    window.print();
  };

  const openRefund = async (payment) => {
    try {
      if (!selectedPayment || selectedPayment.paymentId !== payment.paymentId) {
        const { data } = await getPaymentById(payment._id || payment.paymentId);
        setSelectedPayment(data.data);
      }
      setRefundTarget(payment);
      setRefundOpen(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Unable to open refund dialog");
    }
  };

  const submitRefund = async (payload) => {
    if (!refundTarget) return;
    setProcessingRefund(true);
    try {
      const key = globalThis.crypto?.randomUUID?.() || `refund-${Date.now()}-${Math.random()}`;
      await refundPayment(refundTarget._id || refundTarget.paymentId, payload, key);
      toast.success("Refund processed");
      setRefundOpen(false);
      setRefundTarget(null);
      await refreshPaymentWorkspace();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Unable to process refund");
    } finally {
      setProcessingRefund(false);
    }
  };

  const submitReconciliation = async (payment) => {
    try {
      await reconcilePayment(payment._id || payment.paymentId);
      toast.success("Payment reconciled");
      await refreshPaymentWorkspace();
      await openDetails(payment);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Unable to reconcile payment");
    }
  };

  const confirmDeletePayment = async () => {
    if (!deleteTarget) return;

    setDeletingPayment(true);
    try {
      await deletePayment(deleteTarget._id || deleteTarget.paymentId);
      toast.success("Payment deleted");
      setDeleteTarget(null);
      await refreshPaymentWorkspace();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Unable to delete payment");
    } finally {
      setDeletingPayment(false);
    }
  };

  const exportFilteredPayments = async () => {
    try {
      const { data } = await exportPayments({
        search: filters.search || undefined,
        range: filters.range || undefined,
        status: filters.status || undefined,
        method: filters.method || undefined,
        startDate: filters.range === "custom" ? filters.startDate || undefined : undefined,
        endDate: filters.range === "custom" ? filters.endDate || undefined : undefined,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      });

      const url = URL.createObjectURL(data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("Payments exported");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Unable to export payments");
    }
  };

  const retry = () => loadPayments(filtersRef.current);

  const tableContent = payments;
  const attentionPayments = payments.filter((payment) => {
    const status = String(payment.paymentStatus || "").toUpperCase();
    const reconciliation = String(payment.reconciliationStatus || "UNRECONCILED").toUpperCase();
    return ["PENDING", "PROCESSING", "FAILED", "PARTIALLY_REFUNDED"].includes(status) || reconciliation !== "RECONCILED";
  }).slice(0, 4);

  const analyticsRef = useRef(null);
  const [analyticsVisible, setAnalyticsVisible] = useState(false);

  useEffect(() => {
    const node = analyticsRef.current;
    if (!node) return undefined;
    if (typeof IntersectionObserver === "undefined") {
      setAnalyticsVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setAnalyticsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="space-y-4 pb-20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Payments</h2>
          <p className="mt-1 text-sm text-slate-500">Review payment health, exceptions, bills and reconciliation activity.</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <button type="button" onClick={refreshPaymentWorkspace} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 sm:flex-none"><FiRefreshCw aria-hidden="true" />Refresh</button>
          <button type="button" onClick={() => setMobileFiltersOpen(true)} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 lg:hidden"><FiFilter aria-hidden="true" />Filters</button>
        </div>
      </div>

      <PaymentStats stats={stats} loading={loadingStats} />

      {!loadingPayments && attentionPayments.length ? <section className="ops-card p-3 sm:p-4" aria-labelledby="payment-attention-title">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 id="payment-attention-title" className="flex items-center gap-2 text-base font-bold text-slate-900"><FiAlertTriangle className="text-amber-500" aria-hidden="true" />Needs attention</h3><p className="mt-0.5 text-xs text-slate-500">Current ledger entries with an unresolved payment or reconciliation status.</p></div><span className="text-xs font-semibold text-slate-500">{attentionPayments.length} shown</span></div>
        <div className="mt-3 grid gap-2 lg:grid-cols-2">{attentionPayments.map((payment) => <button type="button" key={payment._id || payment.paymentId} onClick={() => openDetails(payment)} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left transition hover:bg-slate-100"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{payment.paymentIdDisplay || payment.paymentId}</p><p className="mt-0.5 truncate text-xs text-slate-600">{payment.orderIdValue || (payment.billNumber ? `Bill ${payment.billNumber}` : "No bill reference")} · {paymentMethodLabel(payment.paymentMethod)}</p><p className="mt-1 text-xs font-medium text-slate-600">{paymentStatusLabel(payment.paymentStatus)} · {(payment.reconciliationStatus || "UNRECONCILED").replaceAll("_", " ")}</p></div><strong className="shrink-0 text-base text-slate-900">{formatCurrency(getPaymentAmount(payment))}</strong></button>)}</div>
      </section> : null}

      <div className="hidden lg:block"><PaymentFilters filters={filters} onChange={updateFilters} onExport={exportFilteredPayments} onReset={() => setFilters(defaultFilters)} /></div>


      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-center shadow-sm">
          <p className="text-lg font-semibold text-rose-700">Unable to load payments</p>
          <p className="mt-1 text-sm text-rose-600">{error}</p>
          <button onClick={retry} className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white">
            Try Again
          </button>
        </div>
      ) : (
        <section aria-labelledby="payment-ledger-title"><div className="mb-3 flex flex-wrap items-end justify-between gap-2"><div><h3 id="payment-ledger-title" className="text-base font-bold text-slate-900">Payment ledger</h3><p className="mt-0.5 text-xs text-slate-500">Status, method, reference, and reconciliation are retained for each transaction.</p></div><span className="text-xs text-slate-500">{meta.total || 0} transaction{meta.total === 1 ? "" : "s"}</span></div>
          <PaymentTable
            payments={tableContent}
            loading={loadingPayments}
            meta={meta}
            hasFilters={Boolean(filters.search || filters.range || filters.status || filters.method || filters.startDate || filters.endDate)}
            onView={openDetails}
            onReceipt={openReceipt}
            onRefund={openRefund}
            onDelete={setDeleteTarget}
            onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
          />
        </section>
      )}

      <AdvancedBillingWorkspace onPaymentRecorded={refreshPaymentWorkspace} />

      <ReconciliationWorkspace refreshVersion={reconciliationRefreshVersion} />

      <div ref={analyticsRef} className="min-h-[13rem] sm:min-h-[24rem]">
        {analyticsVisible ? (
          <Suspense fallback={<div className="h-52 animate-pulse rounded-xl bg-slate-100 sm:h-96 sm:rounded-2xl" />}>
            <PaymentAnalytics stats={stats} loading={loadingStats} />
          </Suspense>
        ) : (
          <div className="h-52 animate-pulse rounded-xl bg-slate-100 sm:h-96 sm:rounded-2xl" />
        )}
      </div>

      <Suspense fallback={null}>
        <PaymentDetailsDrawer
          open={detailOpen}
          payment={selectedPayment}
          loading={detailLoading}
          onClose={() => setDetailOpen(false)}
          onReceipt={openReceipt}
          onRefund={openRefund}
          onReconcile={submitReconciliation}
        />
      </Suspense>

      <Suspense fallback={null}>
        <PaymentReceipt
          open={receiptOpen}
          payment={selectedPayment}
          onClose={() => setReceiptOpen(false)}
          onDownload={downloadReceipt}
          onPrint={printReceipt}
        />
      </Suspense>

      <Suspense fallback={null}>
        <RefundModal
          open={refundOpen}
          payment={refundTarget}
          loading={processingRefund}
          onClose={() => setRefundOpen(false)}
          onSubmit={submitRefund}
        />
      </Suspense>

      <Suspense fallback={null}>
        <ConfirmDialog
          open={Boolean(deleteTarget)}
          title="Delete payment"
          message="This will permanently remove the payment record. Continue?"
          loading={deletingPayment}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDeletePayment}
        />
      </Suspense>

      <PaymentFilters
        variant="mobile"
        mobileOpen={mobileFiltersOpen}
        filters={filters}
        onChange={updateFilters}
        onExport={exportFilteredPayments}
        onReset={() => setFilters(defaultFilters)}
        onClose={() => setMobileFiltersOpen(false)}
      />
    </div>
  );
};

export default Payments;
