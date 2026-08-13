import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import { fetchPublicPlans, parsePublicPlansResponse } from "../../services/publicSubscriptionService";
import { fetchMySubscription } from "../../services/billingService";
import { startPlanCheckout } from "../../utils/razorpayCheckout";
import {
  clearSelectedPlan,
  getSelectedPlan,
  planDisplayName,
  saveCheckoutResult,
  saveSelectedPlan,
} from "../../utils/planSelection";

const formatMoney = (amount, currency = "INR") => {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount || 0);
  } catch {
    return `₹${amount || 0}`;
  }
};

const SubscribeCheckoutPage = () => {
  const navigate = useNavigate();
  const { accessToken, user } = useSelector((state) => state.auth);
  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [planKey, setPlanKey] = useState(getSelectedPlan() || "basic");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      navigate("/login", {
        replace: true,
        state: { from: { pathname: "/subscribe/checkout" }, selectedPlan: getSelectedPlan() },
      });
      return;
    }
    if (user && user.role !== "admin") {
      toast.error("Restaurant admin account required");
      navigate("/subscribe/register", { replace: true });
      return;
    }
    if (user && !user.restaurant) {
      navigate("/subscribe/register", { replace: true });
    }
  }, [accessToken, user, navigate]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [plansRes, subRes] = await Promise.all([
          fetchPublicPlans(),
          fetchMySubscription().catch(() => ({ data: { data: null } })),
        ]);
        setPlans(parsePublicPlansResponse(plansRes.data).plans);
        setSubscription(subRes.data?.data || null);

        const remembered =
          getSelectedPlan() ||
          subRes.data?.data?.metadata?.selectedPaidPlan ||
          subRes.data?.data?.planName ||
          "basic";
        setPlanKey(remembered);
        saveSelectedPlan(remembered);
      } catch (err) {
        toast.error(err?.response?.data?.message || "Unable to load checkout");
      } finally {
        setLoading(false);
      }
    };
    if (accessToken && user?.restaurant) load();
  }, [accessToken, user]);

  const selectedPlan = useMemo(
    () => plans.find((p) => p.key === planKey) || null,
    [plans, planKey]
  );

  const pay = async () => {
    if (!selectedPlan) return;
    setBusy(true);
    try {
      saveSelectedPlan(selectedPlan.key);
      const result = await startPlanCheckout({
        planKey: selectedPlan.key,
        planName: selectedPlan.name,
      });

      saveCheckoutResult({
        planKey: selectedPlan.key,
        planName: selectedPlan.name,
        amount: selectedPlan.price,
        currency: selectedPlan.currency || "INR",
        paymentId:
          result.razorpayPaymentId ||
          result.subscription?.metadata?.lastGatewayPaymentId ||
          result.checkout?.paymentId,
        razorpayOrderId: result.razorpayOrderId || result.checkout?.razorpayOrderId,
        subscription: result.subscription,
      });
      clearSelectedPlan();
      toast.success("Payment successful");
      navigate("/subscribe/success", { replace: true });
    } catch (err) {
      const message = err?.response?.data?.message || err?.message || "Payment failed";
      if (message.toLowerCase().includes("cancelled")) {
        toast.error("Payment cancelled");
      } else {
        toast.error(message);
        navigate("/subscribe/failed", { replace: true, state: { planKey, message } });
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
      </div>
    );
  }

  if (subscription?.status === "active") {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <h1 className="text-2xl font-bold text-emerald-900">Subscription already active</h1>
        <p className="mt-2 text-emerald-800">
          {planDisplayName(subscription.planName)} · {formatMoney(subscription.price)}
        </p>
        <Link
          to="/dashboard/admin/my-subscription"
          className="mt-6 inline-block rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white"
        >
          Go to My Subscription
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-center text-3xl font-bold text-slate-900">Complete payment</h1>
      <p className="mt-2 text-center text-slate-600">Secure checkout powered by Razorpay (TEST mode supported).</p>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-sm font-medium text-slate-700">
          Plan
          <select
            className="mt-1 w-full rounded-xl border border-slate-300 p-3"
            value={planKey}
            onChange={(e) => {
              setPlanKey(e.target.value);
              saveSelectedPlan(e.target.value);
            }}
          >
            {plans.map((p) => (
              <option key={p.key} value={p.key}>
                {p.name} — {formatMoney(p.price, p.currency)}/mo
              </option>
            ))}
          </select>
        </label>

        {selectedPlan && (
          <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            <p>
              <span className="font-medium">Amount:</span> {formatMoney(selectedPlan.price, selectedPlan.currency)} / month
            </p>
            <p className="mt-1">
              <span className="font-medium">Restaurant:</span> {user?.email}
            </p>
            <ul className="mt-3 space-y-1">
              {(selectedPlan.features || []).slice(0, 4).map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="button"
          disabled={busy || !selectedPlan}
          onClick={pay}
          className="mt-6 w-full rounded-xl bg-teal-700 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {busy ? "Processing..." : `Pay ${selectedPlan ? formatMoney(selectedPlan.price, selectedPlan.currency) : ""}`}
        </button>

        <Link to="/pricing" className="mt-4 block text-center text-sm text-slate-500 hover:text-teal-700">
          Back to Pricing
        </Link>
      </div>
    </div>
  );
};

export default SubscribeCheckoutPage;
