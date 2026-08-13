import { Link, useLocation } from "react-router-dom";
import { getSelectedPlan } from "../../utils/planSelection";

const SubscribeFailedPage = () => {
  const location = useLocation();
  const message = location.state?.message || "Your payment could not be completed.";
  const planKey = location.state?.planKey || getSelectedPlan();

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-2xl text-rose-700">!</div>
      <h1 className="mt-4 text-3xl font-bold text-slate-900">Payment Failed</h1>
      <p className="mt-2 text-slate-600">{message}</p>
      <p className="mt-1 text-sm text-slate-500">Your subscription was not activated.</p>

      <div className="mt-6 flex flex-col gap-3">
        <Link
          to="/subscribe/checkout"
          state={{ selectedPlan: planKey }}
          className="rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-800"
        >
          Try Again
        </Link>
        <Link to="/pricing" className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Back to Pricing
        </Link>
      </div>
    </div>
  );
};

export default SubscribeFailedPage;
