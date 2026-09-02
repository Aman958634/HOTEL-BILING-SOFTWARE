import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  fetchMyBillingPayments,
  fetchMySubscription,
  downloadMyBillingPaymentPdf,
} from "../../services/billingService";
import { SubscriptionStatusBadge } from "../../components/subscription/SubscriptionWidgets";
import { planDisplayName, saveSelectedPlan } from "../../utils/planSelection";
import { FiDownload } from "react-icons/fi";

const formatMoney = (amount, currency = "INR") => {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount || 0);
  } catch {
    return `₹${amount || 0}`;
  }
};

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const showTime = d.getHours() !== 0 || d.getMinutes() !== 0;
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(showTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
};

const MySubscriptionPage = () => {
  const [subscription, setSubscription] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pdfBusyId, setPdfBusyId] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [subRes, payRes] = await Promise.all([
        fetchMySubscription(),
        fetchMyBillingPayments().catch(() => ({ data: { data: [] } })),
      ]);
      setSubscription(subRes.data?.data || null);
      setPayments(payRes.data?.data || []);
    } catch (err) {
      const message = err?.response?.data?.message || "Unable to load subscription";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-52 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    );
  }

  const planName = planDisplayName(subscription?.planName);
  const canUpgrade = subscription && ["trial", "expired", "cancelled"].includes(subscription.status);

  const downloadPdf = async (payment) => {
    const paymentRecordId = payment?.id;
    if (!paymentRecordId) {
      toast.error("Payment ID missing");
      return;
    }

    setPdfBusyId(paymentRecordId);
    try {
      const res = await downloadMyBillingPaymentPdf(paymentRecordId);
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const filenameId = payment?.paymentId || payment?.razorpayPaymentId || paymentRecordId;
      link.download = `RestoSphere-Payment-${filenameId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Payment receipt downloaded successfully.");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Unable to download payment receipt.");
    } finally {
      setPdfBusyId("");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">My Subscription</h2>
          <p className="mt-1 text-sm text-slate-500">Your current plan, renewal, and payment history.</p>
        </div>
        <button
          type="button"
          onClick={load}
          className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-medium hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><p className="font-semibold">Unable to load subscription</p><p className="mt-1">{error}</p><button type="button" onClick={load} className="mt-3 min-h-10 rounded-xl border border-rose-200 bg-white px-3 text-sm font-semibold text-rose-700">Retry</button></div> : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        {!subscription ? (
          <p className="text-slate-600">No subscription found.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm uppercase tracking-wide text-slate-500">Current Plan</p>
                <h3 className="mt-1 text-2xl font-bold text-slate-900">{planName}</h3>
                <p className="mt-1 text-lg font-semibold text-teal-800">
                  {subscription.status === "trial"
                    ? "Free trial"
                    : `${formatMoney(subscription.price)} / month`}
                </p>
              </div>
              <SubscriptionStatusBadge status={subscription.status} />
            </div>

            {subscription.status === "trial" ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><p className="font-semibold">Trial access</p><p className="mt-1">{subscription.daysRemainingLabel || "Trial in progress"}{subscription.trialEndAt ? ` · Ends ${formatDate(subscription.trialEndAt)}` : ""}</p></div> : null}
            {subscription.status === "expired" ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900"><p className="font-semibold">Subscription expired</p><p className="mt-1">{subscription.renewalDate ? `Expired ${formatDate(subscription.renewalDate)}` : "Choose an available plan to continue."}</p></div> : null}
            <div className="mt-5 grid gap-3 text-sm text-slate-700 md:grid-cols-2">
              <p>
                <span className="font-medium">Status:</span> {String(subscription.status || "").toUpperCase()}
              </p>
              <p>
                <span className="font-medium">Payment Status:</span>{" "}
                {subscription.status === "active" ? "SUCCESS" : subscription.status === "trial" ? "TRIAL" : "—"}
              </p>
              <p>
                <span className="font-medium">Start Date:</span>{" "}
                {formatDate(subscription.subscriptionStartAt || subscription.trialStartAt || subscription.startDate)}
              </p>
              <p>
                <span className="font-medium">Renewal Date:</span>{" "}
                {subscription.status === "active" ? formatDate(subscription.renewalDate) : "—"}
              </p>
              {subscription.status === "trial" && (
                <p>
                  <span className="font-medium">Trial Ends:</span> {formatDate(subscription.trialEndAt)}
                </p>
              )}
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {canUpgrade && (
                <Link
                  to="/subscribe/checkout"
                  onClick={() => saveSelectedPlan(subscription.metadata?.selectedPaidPlan || subscription.planName || "basic")}
                  className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
                >
                  Upgrade / Pay Now
                </Link>
              )}
              <Link to="/pricing" className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                View Pricing
              </Link>
            </div>
          </>
        )}
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h3 className="font-semibold text-slate-900">Payment History</h3>
        </div>
        <div className="hidden overflow-x-auto md:block"><table className="subscription-history-table min-w-[760px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">Payment ID</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  No payments yet.
                </td>
              </tr>
            )}
            {payments.map((p) => (
              <tr key={p.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-mono text-xs">{p.paymentId || "—"}</td>
                <td className="px-4 py-3">{planDisplayName(p.plan)}</td>
                <td className="px-4 py-3">{formatMoney(p.amount, p.currency)}</td>
                <td className="px-4 py-3">{p.paymentMethod || "—"}</td>
                <td className="px-4 py-3">{p.status}</td>
                <td className="px-4 py-3">{formatDate(p.paymentDate || p.paidAt || p.createdAt)}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    disabled={Boolean(pdfBusyId && pdfBusyId !== p.id)}
                    onClick={() => downloadPdf(p)}
                    className="inline-flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    title="Download PDF receipt"
                  >
                    <FiDownload className="text-sm" />
                    {pdfBusyId === p.id ? "Downloading..." : "Download PDF"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <div className="space-y-3 p-3 md:hidden">{payments.length === 0 ? <p className="p-5 text-center text-sm text-slate-500">No payments yet.</p> : payments.map((p) => <article key={p.id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-all font-mono text-xs text-slate-700">{p.paymentId || "—"}</p><p className="mt-1 font-semibold text-slate-900">{formatMoney(p.amount, p.currency)}</p></div><span className="shrink-0 text-xs font-semibold text-slate-700">{p.status}</span></div><p className="mt-2 text-xs text-slate-500">{planDisplayName(p.plan)} · {formatDate(p.paymentDate || p.paidAt || p.createdAt)}</p><button type="button" disabled={Boolean(pdfBusyId && pdfBusyId !== p.id)} onClick={() => downloadPdf(p)} className="mt-3 min-h-10 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700">{pdfBusyId === p.id ? "Downloading..." : "Download PDF"}</button></article>)}</div>
      </div>
    </div>
  );
};

export default MySubscriptionPage;
