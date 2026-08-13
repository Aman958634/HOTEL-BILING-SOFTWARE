import { Link } from "react-router-dom";
import { getCheckoutResult, planDisplayName } from "../../utils/planSelection";

const formatMoney = (amount, currency = "INR") => {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount || 0);
  } catch {
    return `₹${amount || 0}`;
  }
};

const formatDate = (value) => (value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");

const SubscribeSuccessPage = () => {
  const result = getCheckoutResult();
  const sub = result?.subscription;
  const planName = result?.planName || planDisplayName(result?.planKey || sub?.planName);
  const amount = result?.amount ?? sub?.price;
  const paymentId = result?.paymentId || sub?.metadata?.lastPaymentId || "—";

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">✓</div>
      <h1 className="mt-4 text-3xl font-bold text-slate-900">Payment Successful</h1>
      <p className="mt-2 text-slate-600">Your {planName} subscription is now active.</p>

      <div className="mt-6 space-y-2 rounded-xl bg-slate-50 p-4 text-left text-sm text-slate-700">
        <p>
          <span className="font-medium">Amount:</span> {formatMoney(amount, result?.currency || "INR")}
        </p>
        <p>
          <span className="font-medium">Payment ID:</span> {paymentId}
        </p>
        <p>
          <span className="font-medium">Subscription:</span> {(sub?.status || "ACTIVE").toUpperCase()}
        </p>
        <p>
          <span className="font-medium">Next Renewal:</span> {formatDate(sub?.renewalDate)}
        </p>
      </div>

      <Link
        to="/dashboard/admin/my-subscription"
        className="mt-6 inline-block w-full rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-800"
      >
        Go to Dashboard
      </Link>
      <Link to="/dashboard/admin" className="mt-3 inline-block text-sm text-slate-500 hover:text-teal-700">
        Open Admin Home
      </Link>
    </div>
  );
};

export default SubscribeSuccessPage;
