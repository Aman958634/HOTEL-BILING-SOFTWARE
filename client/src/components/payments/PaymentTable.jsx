import { FiFileText, FiEye, FiRotateCcw, FiTrash2 } from "react-icons/fi";
import { paymentBadgeClasses, paymentMethodLabel, paymentStatusLabel, formatCurrency, formatPaymentDate, canRefundPayment, getPaymentAmount } from "../../utils/paymentUtils";
import EmptyState from "../common/EmptyState";
import { SkeletonTable } from "../common/Skeletons";
import { formatPaymentId } from "../../utils/paymentId";
import TablePagination from "../common/TablePagination";

const ActionButton = ({ children, onClick, tone = "default" }) => {
  const className = tone === "danger"
    ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
    : tone === "primary"
      ? "border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100"
      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50";

  return (
    <button type="button" onClick={onClick} className={`inline-flex min-h-10 items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/25 ${className}`}>
      {children}
    </button>
  );
};

const StatusBadge = ({ payment }) => <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${paymentBadgeClasses(payment.paymentStatus)}`}>{paymentStatusLabel(payment.paymentStatus)}</span>;

const PaymentCard = ({ payment, onView, onReceipt, onRefund, onDelete }) => (
  <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="break-all font-mono text-sm font-semibold text-slate-900">{formatPaymentId(payment.paymentIdDisplay || payment.paymentId)}</p>
        <p className="mt-1 break-words text-xs text-slate-500">{payment.orderIdValue || (payment.billNumber ? `Bill ${payment.billNumber}` : "No bill reference")}</p>
      </div>
      <StatusBadge payment={payment} />
    </div>

    <div className="mt-3 flex items-end justify-between gap-3">
      <div className="min-w-0 text-sm text-slate-600">
        <p className="truncate">{paymentMethodLabel(payment.paymentMethod)}{payment.tableNumber ? ` · Table ${payment.tableNumber}` : ""}</p>
        <p className="mt-1 text-xs text-slate-500">{formatPaymentDate(payment.createdAt)}</p>
      </div>
      <p className="shrink-0 text-lg font-bold tracking-tight text-slate-900">{formatCurrency(getPaymentAmount(payment))}</p>
    </div>

    <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs"><span className="min-w-0 text-slate-500">Reconciliation<br /><strong className="break-words text-slate-800">{(payment.reconciliationStatus || "UNRECONCILED").replaceAll("_", " ")}</strong></span><span className="min-w-0 text-right text-slate-500">Reference<br /><strong className="break-all font-mono text-slate-800">{payment.transactionId || payment.razorpayPaymentId || "—"}</strong></span></div>

    <div className="mt-3 flex flex-wrap gap-2">
      <ActionButton onClick={() => onView(payment)} tone="primary"><FiEye /> View</ActionButton>
      <ActionButton onClick={() => onReceipt(payment)}><FiFileText /> Receipt</ActionButton>
      {canRefundPayment(payment) ? (
        <ActionButton onClick={() => onRefund(payment)} tone="danger"><FiRotateCcw /> Refund</ActionButton>
      ) : null}
      <ActionButton onClick={() => onDelete(payment)} tone="danger"><FiTrash2 /> Delete</ActionButton>
    </div>
  </article>
);

const PaymentTable = ({ payments, loading, meta, onView, onReceipt, onRefund, onDelete, onPageChange, hasFilters = false }) => {
  if (loading) {
    return <SkeletonTable rows={6} columns={7} />;
  }

  if (!payments.length) {
    return <EmptyState icon={<FiFileText className="h-10 w-10" />} title={hasFilters ? "No matching payments" : "No payments yet"} description={hasFilters ? "Try changing your search or filters." : "Completed payment transactions will appear here."} />;
  }

  return (
    <div className="space-y-4">
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="min-w-[820px] w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Payment ID</th>
              <th className="px-4 py-3">Order / Bill</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Reconciliation</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Date &amp; Time</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment._id || payment.paymentId} className="border-b border-slate-100 text-slate-700 last:border-0">
                <td className="max-w-[10rem] break-all px-4 py-3 font-mono text-xs font-semibold text-slate-900">{formatPaymentId(payment.paymentIdDisplay || payment.paymentId)}</td>
                <td className="px-4 py-3">{payment.orderIdValue || (payment.billNumber ? `Bill ${payment.billNumber}` : "-")}</td>
                <td className="px-4 py-3 font-medium text-slate-900">{formatCurrency(getPaymentAmount(payment))}</td>
                <td className="px-4 py-3">{paymentMethodLabel(payment.paymentMethod)}</td>
                <td className="px-4 py-3"><StatusBadge payment={payment} /></td>
                <td className="px-4 py-3 text-xs font-medium text-slate-600">{(payment.reconciliationStatus || "UNRECONCILED").replaceAll("_", " ")}</td>
                <td className="max-w-[12rem] break-all px-4 py-3 font-mono text-xs text-slate-600">{payment.transactionId || payment.razorpayPaymentId || "—"}</td>
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

      <TablePagination meta={meta} onPageChange={onPageChange} itemLabel="payments" />
    </div>
  );
};

export default PaymentTable;
