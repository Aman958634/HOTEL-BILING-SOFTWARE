import { lazy, Suspense, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import PaymentStats from "../../components/payments/PaymentStats";
import AdvancedBillingWorkspace from "../../components/payments/AdvancedBillingWorkspace";
import PaymentFilters from "../../components/payments/PaymentFilters";
import PaymentTable from "../../components/payments/PaymentTable";
import { useSocket } from "../../context/SocketContext";
import { deletePayment, exportPayments, getPaymentById, getPaymentReceipt, getPayments, getPaymentStats, refundPayment } from "../../services/paymentService";

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

  const socket = useSocket();
  const filtersRef = useRef(filters);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const updateFilters = (patch) => {
    setFilters((current) => ({ ...current, ...patch }));
  };

  const loadStats = async (range = filtersRef.current.range) => {
    setLoadingStats(true);
    try {
      const { data } = await getPaymentStats(range ? { range } : {});
      setStats(data.data || null);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Unable to load payment stats");
    } finally {
      setLoadingStats(false);
    }
  };

  const loadPayments = async (currentFilters = filtersRef.current) => {
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
  };

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
  }, [filters]);

  useEffect(() => {
    if (!socket) return;

    const refresh = () => {
      loadPayments(filtersRef.current);
      loadStats(filtersRef.current.range);
    };

    socket.on("payment:created", refresh);
    socket.on("payment:updated", refresh);
    socket.on("payment:refunded", refresh);

    return () => {
      socket.off("payment:created", refresh);
      socket.off("payment:updated", refresh);
      socket.off("payment:refunded", refresh);
    };
  }, [socket]);

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
      await refundPayment(refundTarget._id || refundTarget.paymentId, payload);
      toast.success("Refund processed");
      setRefundOpen(false);
      setRefundTarget(null);
      await Promise.all([loadPayments(), loadStats(filtersRef.current.range)]);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Unable to process refund");
    } finally {
      setProcessingRefund(false);
    }
  };

  const confirmDeletePayment = async () => {
    if (!deleteTarget) return;

    setDeletingPayment(true);
    try {
      await deletePayment(deleteTarget._id || deleteTarget.paymentId);
      toast.success("Payment deleted");
      setDeleteTarget(null);
      await Promise.all([loadPayments(), loadStats(filtersRef.current.range)]);
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Payments</h2>
          <p className="mt-1 text-sm text-slate-500">Track transactions, payment status, refunds and revenue.</p>
        </div>
      </div>

      <div className="hidden lg:block">
        <PaymentFilters
          filters={filters}
          onChange={updateFilters}
          onExport={exportFilteredPayments}
          onReset={() => setFilters(defaultFilters)}
        />
      </div>

      <PaymentStats stats={stats} loading={loadingStats} />

      <AdvancedBillingWorkspace />

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-center shadow-sm">
          <p className="text-lg font-semibold text-rose-700">Unable to load payments</p>
          <p className="mt-1 text-sm text-rose-600">{error}</p>
          <button onClick={retry} className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white">
            Try Again
          </button>
        </div>
      ) : (
        <div className="min-h-[20rem]">
          <PaymentTable
            payments={tableContent}
            loading={loadingPayments}
            meta={meta}
            onView={openDetails}
            onReceipt={openReceipt}
            onRefund={openRefund}
            onDelete={setDeleteTarget}
            onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
          />
        </div>
      )}

      <div ref={analyticsRef} className="min-h-[24rem]">
        {analyticsVisible ? (
          <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-slate-100" />}>
            <PaymentAnalytics stats={stats} loading={loadingStats} />
          </Suspense>
        ) : (
          <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
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
