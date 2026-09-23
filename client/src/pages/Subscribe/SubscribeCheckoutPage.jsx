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
  getSelectedPremiumDurationYears,
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
  const [premiumDurationYears, setPremiumDurationYears] = useState(getSelectedPremiumDurationYears());
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
        const rememberedYears = subRes.data?.data?.metadata?.selectedPremiumDurationYears || getSelectedPremiumDurationYears();
        setPlanKey(remembered);
        setPremiumDurationYears(rememberedYears);
        saveSelectedPlan(remembered, remembered === "enterprise" ? rememberedYears : null);
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
  const selectedPremiumOffer = useMemo(
    () => selectedPlan?.key === "enterprise"
      ? (selectedPlan.premiumDurationOptions || []).find((option) => option.years === premiumDurationYears)
      : null,
    [selectedPlan, premiumDurationYears]
  );
  const displayedAmount = selectedPremiumOffer?.amount ?? selectedPlan?.price;
  const displayedDuration = selectedPremiumOffer?.durationLabel || selectedPlan?.durationLabel || "plan";

  const pay = async () => {
    if (!selectedPlan) return;
    setBusy(true);
    try {
      saveSelectedPlan(selectedPlan.key, selectedPlan.key === "enterprise" ? premiumDurationYears : null);
      const result = await startPlanCheckout({
        planKey: selectedPlan.key,
        planName: selectedPlan.name,
        premiumDurationYears: selectedPlan.key === "enterprise" ? premiumDurationYears : undefined,
      });

      saveCheckoutResult({
        planKey: selectedPlan.key,
        planName: selectedPlan.name,
        // Display the amount returned by the server-created checkout, not a client-side price.
        amount: result.checkout?.amountRupees ?? selectedPlan.price,
        currency: result.checkout?.currency || selectedPlan.currency || "INR",
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
      <p className="mt-2 text-center text-slate-600">Secure checkout powered by Razorpay.</p>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-sm font-medium text-slate-700">
          Plan
          <select
            className="mt-1 w-full rounded-xl border border-slate-300 p-3"
            value={planKey}
            onChange={(e) => {
              setPlanKey(e.target.value);
              saveSelectedPlan(e.target.value, e.target.value === "enterprise" ? premiumDurationYears : null);
            }}
          >
            {plans.map((p) => (
              <option key={p.key} value={p.key}>
                {p.name} — {formatMoney(p.price, p.currency)} / {p.durationLabel || "plan"}
              </option>
            ))}
          </select>
        </label>

        {selectedPlan && (
          <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            <p>
              <span className="font-medium">Total payable:</span> {formatMoney(displayedAmount, selectedPlan.currency)} / {displayedDuration}
            </p>
            {selectedPlan.monthlyEquivalentPrice ? (
              <p className="mt-1"><span className="font-medium">Effective monthly price:</span> {formatMoney(selectedPlan.monthlyEquivalentPrice, selectedPlan.currency)} per month</p>
            ) : null}
            {selectedPlan.key === "enterprise" && (
              <fieldset className="mt-4" aria-label="Premium subscription term">
                <legend className="font-medium">Premium term</legend>
                <div className="mt-2 grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((years) => <button key={years} type="button" aria-pressed={premiumDurationYears === years} onClick={() => { setPremiumDurationYears(years); saveSelectedPlan(selectedPlan.key, years); }} className={`min-h-10 rounded-lg border text-xs font-semibold ${premiumDurationYears === years ? "border-teal-700 bg-teal-700 text-white" : "border-slate-300 text-slate-700 hover:bg-teal-50"}`}>{years}Y</button>)}
                </div>
                <p className="mt-2">{formatMoney(selectedPlan.monthlyEquivalentPrice, selectedPlan.currency)} per month · {displayedDuration}</p>
              </fieldset>
            )}
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
          {busy ? "Processing..." : `Pay ${selectedPlan ? formatMoney(displayedAmount, selectedPlan.currency) : ""}`}
        </button>

        <Link to="/pricing" className="mt-4 block text-center text-sm text-slate-500 hover:text-teal-700">
          Back to Pricing
        </Link>
      </div>
    </div>
  );
};

export default SubscribeCheckoutPage;
