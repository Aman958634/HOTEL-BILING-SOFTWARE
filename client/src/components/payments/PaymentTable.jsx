import { FiFileText, FiEye, FiRotateCcw, FiTrash2 } from "react-icons/fi";
import { paymentBadgeClasses, paymentMethodLabel, paymentStatusLabel, formatCurrency, formatPaymentDate, canRefundPayment, getPaymentAmount } from "../../utils/paymentUtils";
import EmptyState from "../common/EmptyState";
import { SkeletonTable } from "../common/Skeletons";
import { formatPaymentId } from "../../utils/paymentId";

const ActionButton = ({ children, onClick, tone = "default" }) => {
  const className = tone === "danger"
    ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
    : tone === "primary"
      ? "border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100"
      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50";

  return (
    <button onClick={onClick} className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${className}`}>
      {children}
    </button>
  );
};

const Pagination = ({ meta, onPageChange }) => {
  const totalPages = meta.totalPages || 1;
  const page = meta.page || 1;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm">
      <p className="text-slate-600">
        Showing {(page - 1) * meta.limit + (meta.total ? 1 : 0)}-{Math.min(page * meta.limit, meta.total || 0)} of {meta.total || 0} payments
      </p>
      <div className="flex items-center gap-2">
        <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 disabled:opacity-60">
          Previous
        </button>
        {Array.from({ length: Math.min(totalPages, 5) }).map((_, index) => {
          const current = index + 1;
          return (
            <button
              key={current}
              onClick={() => onPageChange(current)}
              className={`rounded-lg border px-3 py-1.5 ${page === current ? "border-brand-700 bg-brand-700 text-white" : "border-slate-300 bg-white text-slate-700"}`}
            >
              {current}
            </button>
          );
        })}
        <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 disabled:opacity-60">
          Next
        </button>
      </div>
    </div>
  );
};

const PaymentCard = ({ payment, onView, onReceipt, onRefund, onDelete }) => (
  <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-slate-900">{formatPaymentId(payment.paymentIdDisplay || payment.paymentId)}</p>
        <p className="text-xs text-slate-500">{formatPaymentDate(payment.createdAt)}</p>
      </div>
      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${paymentBadgeClasses(payment.paymentStatus)}`}>
        {paymentStatusLabel(payment.paymentStatus)}
      </span>
    </div>

    <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-700">
      <p><strong>Order:</strong> {payment.orderIdValue}</p>
      <p><strong>Customer:</strong> {payment.customerName || "Guest"}</p>
      <p><strong>Table:</strong> {payment.tableNumber || "-"}</p>
      <p><strong>Amount:</strong> {formatCurrency(getPaymentAmount(payment))}</p>
      <p><strong>Method:</strong> {paymentMethodLabel(payment.paymentMethod)}</p>
      <p><strong>Gateway:</strong> {payment.gatewayLabel || payment.gateway || "-"}</p>
      <p><strong>Refund:</strong> {formatCurrency(payment.refundAmount || 0)}</p>
      <p><strong>Reconciliation:</strong> {(payment.reconciliationStatus || "UNRECONCILED").replaceAll("_", " ")}</p>
    </div>

    <div className="mt-4 flex flex-wrap gap-2">
      <ActionButton onClick={() => onView(payment)} tone="primary"><FiEye /> View</ActionButton>
      <ActionButton onClick={() => onReceipt(payment)}><FiFileText /> Receipt</ActionButton>
      {canRefundPayment(payment) ? (
        <ActionButton onClick={() => onRefund(payment)} tone="danger"><FiRotateCcw /> Refund</ActionButton>
      ) : null}
      <ActionButton onClick={() => onDelete(payment)} tone="danger"><FiTrash2 /> Delete</ActionButton>
    </div>
  </article>
);

const PaymentTable = ({ payments, loading, meta, onView, onReceipt, onRefund, onDelete, onPageChange }) => {
  if (loading) {
    return <SkeletonTable rows={6} columns={7} />;
  }

  if (!payments.length) {
    return <EmptyState icon={<FiFileText className="h-10 w-10" />} title="No payments yet" description="Completed payment transactions will appear here." />;
  }

  return (
    <div className="space-y-4">
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Payment ID</th>
              <th className="px-4 py-3">Order ID</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Table</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Gateway</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Reconciliation</th>
              <th className="px-4 py-3">Date &amp; Time</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment._id || payment.paymentId} className="border-b border-slate-100 text-slate-700 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-900">{formatPaymentId(payment.paymentIdDisplay || payment.paymentId)}</td>
                <td className="px-4 py-3">{payment.orderIdValue}</td>
                <td className="px-4 py-3">{payment.customerName || "Guest"}</td>
                <td className="px-4 py-3">{payment.tableNumber ? `Table ${payment.tableNumber}` : "-"}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{formatCurrency(getPaymentAmount(payment))}</td>
                <td className="px-4 py-3">{paymentMethodLabel(payment.paymentMethod)}</td>
                <td className="px-4 py-3">{payment.gatewayLabel || payment.gateway || payment.metadata?.gateway || payment.metadata?.provider || "-"}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${paymentBadgeClasses(payment.paymentStatus)}`}>
                    {paymentStatusLabel(payment.paymentStatus)}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs font-medium text-slate-600">{(payment.reconciliationStatus || "UNRECONCILED").replaceAll("_", " ")}</td>
                <td className="px-4 py-3">{formatPaymentDate(payment.createdAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <ActionButton onClick={() => onView(payment)} tone="primary"><FiEye /> View</ActionButton>
                    <ActionButton onClick={() => onReceipt(payment)}><FiFileText /> Receipt</ActionButton>
                    {canRefundPayment(payment) ? <ActionButton onClick={() => onRefund(payment)} tone="danger"><FiRotateCcw /> Refund</ActionButton> : null}
                    <ActionButton onClick={() => onDelete(payment)} tone="danger"><FiTrash2 /> Delete</ActionButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {payments.map((payment) => (
          <PaymentCard key={payment._id || payment.paymentId} payment={payment} onView={onView} onReceipt={onReceipt} onRefund={onRefund} onDelete={onDelete} />
        ))}
      </div>

      <Pagination meta={meta} onPageChange={onPageChange} />
    </div>
  );
};

export default PaymentTable;
