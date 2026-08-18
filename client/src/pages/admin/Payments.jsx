import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { FiDownload, FiFilter, FiRefreshCw, FiFileText } from "react-icons/fi";
import PaymentStats from "../../components/payments/PaymentStats";
import PaymentFilters from "../../components/payments/PaymentFilters";
import PaymentTable from "../../components/payments/PaymentTable";
import PaymentDetailsDrawer from "../../components/payments/PaymentDetailsDrawer";
import PaymentReceipt from "../../components/payments/PaymentReceipt";
import RefundModal from "../../components/payments/RefundModal";
import PaymentAnalytics from "../../components/payments/PaymentAnalytics";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import { useSocket } from "../../context/SocketContext";
import { deletePayment, exportPayments, getPaymentById, getPaymentReceipt, getPayments, getPaymentStats, refundPayment } from "../../services/paymentService";

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

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadPayments(filters);
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [filters]);

  useEffect(() => {
    loadStats(filters.range);
  }, [filters.range]);

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

  const tableContent = useMemo(() => payments, [payments]);

  return (
    <div className="space-y-4 pb-20">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Payments</h2>
            <p className="mt-1 text-sm text-slate-500">Track transactions, payment status, refunds and revenue.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:hidden">
            <button onClick={() => setMobileFiltersOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700">
              <FiFilter /> Filters
            </button>
            <button onClick={exportFilteredPayments} className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-sm">
              <FiDownload /> Export
            </button>
          </div>
        </div>

        <div className="mt-4 hidden lg:block">
          <PaymentFilters
            filters={filters}
            onChange={updateFilters}
            onExport={exportFilteredPayments}
            onReset={() => setFilters(defaultFilters)}
          />
        </div>
      </section>

      <PaymentStats stats={stats} loading={loadingStats} />

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-center shadow-sm">
          <p className="text-lg font-semibold text-rose-700">Unable to load payments</p>
          <p className="mt-1 text-sm text-rose-600">{error}</p>
          <button onClick={retry} className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white">
            Try Again
          </button>
        </div>
      ) : (
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
      )}

      <PaymentAnalytics stats={stats} loading={loadingStats} />

      <PaymentDetailsDrawer
        open={detailOpen}
        payment={selectedPayment}
        loading={detailLoading}
        onClose={() => setDetailOpen(false)}
        onReceipt={openReceipt}
        onRefund={openRefund}
      />

      <PaymentReceipt
        open={receiptOpen}
        payment={selectedPayment}
        onClose={() => setReceiptOpen(false)}
        onDownload={downloadReceipt}
        onPrint={printReceipt}
      />

      <RefundModal
        open={refundOpen}
        payment={refundTarget}
        loading={processingRefund}
        onClose={() => setRefundOpen(false)}
        onSubmit={submitRefund}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete payment"
        message="This will permanently remove the payment record. Continue?"
        loading={deletingPayment}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDeletePayment}
      />

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
