import { Link } from "react-router-dom";

const statusStyles = {
  trial: "bg-amber-100 text-amber-800 border-amber-200",
  active: "bg-emerald-100 text-emerald-800 border-emerald-200",
  expired: "bg-rose-100 text-rose-800 border-rose-200",
  cancelled: "bg-slate-200 text-slate-700 border-slate-300",
  suspended: "bg-orange-100 text-orange-800 border-orange-200",
};

export const SubscriptionStatusBadge = ({ status }) => {
  const key = String(status || "").toLowerCase();
  const label = key ? key.toUpperCase() : "UNKNOWN";
  return (
    <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${statusStyles[key] || statusStyles.cancelled}`}>
      {label}
    </span>
  );
};

export const TrialBanner = ({ subscription }) => {
  if (!subscription || subscription.status !== "trial") return null;
  const days = subscription.daysRemaining;
  const warning = subscription.warningMessage;
  const label =
    days <= 0 || subscription.daysRemainingLabel === "EXPIRED"
      ? "EXPIRED"
      : subscription.daysRemainingLabel || `${days} days remaining`;

  return (
    <div
      className={`mb-4 rounded-xl border px-4 py-3 ${
        days <= 0
          ? "border-rose-200 bg-rose-50 text-rose-900"
          : days <= 3
            ? "border-rose-200 bg-rose-50 text-rose-900"
            : days <= 7
              ? "border-amber-200 bg-amber-50 text-amber-900"
              : "border-teal-200 bg-teal-50 text-teal-900"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">15-Day Free Trial · {label}</p>
          <p className="mt-1 text-xs text-slate-600">
            Trial Start: {subscription.trialStartAt ? new Date(subscription.trialStartAt).toLocaleString() : "—"}
            {" · "}
            Trial End: {subscription.trialEndAt ? new Date(subscription.trialEndAt).toLocaleString() : "—"}
          </p>
          {warning ? (
            <p className="text-sm mt-1">{warning}</p>
          ) : (
            <p className="text-sm mt-1">Enjoy full access during your 15-day free trial.</p>
          )}
        </div>
        <Link to="/dashboard/admin/billing" className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800">
          View Plans
        </Link>
      </div>
    </div>
  );
};

export const SubscriptionExpiredGate = ({ open, message, onClose }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-2xl font-bold text-slate-900">Your 15-day free trial has ended.</h2>
        <p className="mt-2 text-slate-600">
          {message || "Please choose a paid plan to continue using RestoSphere."}
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Your restaurant data (menu, orders, tables, payments, reports) is preserved. Access resumes after you upgrade.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/dashboard/admin/billing"
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
            onClick={onClose}
          >
            View Plans
          </Link>
          <Link
            to="/dashboard/admin/billing"
            className="rounded-lg border border-teal-700 px-4 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-50"
            onClick={onClose}
          >
            Upgrade Subscription
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionStatusBadge;
