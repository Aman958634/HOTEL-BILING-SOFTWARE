import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  createBillingCheckout,
  fetchBillingPlans,
  fetchMySubscription,
  verifyBillingPayment,
} from "../../services/billingService";
import { SubscriptionStatusBadge } from "../../components/subscription/SubscriptionWidgets";
import { SkeletonCard } from "../../components/common/Skeletons";

const formatMoney = (amount, currency = "INR") => {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount || 0);
  } catch {
    return `₹${amount || 0}`;
  }
};

const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : "—");

const BillingPage = () => {
  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyPlan, setBusyPlan] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [plansRes, subRes] = await Promise.all([fetchBillingPlans(), fetchMySubscription()]);
      setPlans(plansRes.data?.data || []);
      setSubscription(subRes.data?.data || null);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load billing");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const headline = useMemo(() => {
    if (!subscription) return "Choose a plan";
    if (subscription.status === "trial") {
      return `15-Day Free Trial · ${subscription.daysRemainingLabel || "Active"}`;
    }
    if (subscription.status === "expired") return "Your 15-day free trial has ended.";
    if (subscription.status === "active") return `Active · ${subscription.planName}`;
    return String(subscription.status || "").toUpperCase();
  }, [subscription]);

  const upgrade = async (plan) => {
    setBusyPlan(plan.key);
    try {
      const { data } = await createBillingCheckout({ planName: plan.key });
      const checkout = data?.data;

      if (checkout?.testMode) {
        const verify = await verifyBillingPayment({
          paymentId: checkout.paymentId,
          testSuccess: true,
        });
        setSubscription(verify.data?.data || null);
        toast.success("Payment successful. Subscription is now active.");
        return;
      }

      if (!window.Razorpay) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = resolve;
          script.onerror = reject;
          document.body.appendChild(script);
        });
      }

      const rzp = new window.Razorpay({
        key: checkout.keyId,
        amount: Math.round(Number(checkout.amount) * 100),
        currency: checkout.currency || "INR",
        name: "RestoSphere",
        description: `${plan.name} plan`,
        order_id: checkout.razorpayOrderId,
        handler: async (response) => {
          try {
            const verify = await verifyBillingPayment({
              paymentId: checkout.paymentId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            setSubscription(verify.data?.data || null);
            toast.success("Payment successful. Subscription is now active.");
          } catch (err) {
            toast.error(err?.response?.data?.message || "Payment verification failed");
          }
        },
      });
      rzp.open();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Checkout failed");
    } finally {
      setBusyPlan("");
    }
  };

  if (loading) return <div className="space-y-4"><SkeletonCard className="h-32" /><div className="grid gap-4 md:grid-cols-3"><SkeletonCard className="h-64" /><SkeletonCard className="h-64" /><SkeletonCard className="h-64" /></div></div>;

  return (
    <div className="space-y-4 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Billing & Plans</h2>
          <p className="mt-1 text-sm text-slate-500">{headline}</p>
          {subscription && <SubscriptionStatusBadge status={subscription.status} />}
        </div>
        {subscription?.status === "expired" && (
          <span className="rounded-lg bg-rose-100 px-3 py-2 text-sm font-semibold text-rose-800">
            Upgrade Subscription
          </span>
        )}
      </div>

        {subscription?.status === "trial" && (
          <div className="mt-4 grid gap-2 text-sm text-slate-700 md:grid-cols-3">
            <p>
              <span className="font-medium">Trial Start:</span> {formatDateTime(subscription.trialStartAt)}
            </p>
            <p>
              <span className="font-medium">Trial End:</span> {formatDateTime(subscription.trialEndAt)}
            </p>
            <p>
              <span className="font-medium">Days Remaining:</span>{" "}
              {subscription.daysRemaining <= 0 ? "EXPIRED" : subscription.daysRemainingLabel}
            </p>
          </div>
        )}

        {subscription?.status === "expired" && (
          <p className="mt-3 text-rose-700">Please choose a paid plan to continue using RestoSphere. No automatic charge on Day 16.</p>
        )}

        {subscription?.status === "trial" && subscription.warningMessage && (
          <p className="mt-3 text-amber-800">{subscription.warningMessage}</p>
        )}

        {subscription?.status === "active" && (
          <div className="mt-4 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
            <p>
              <span className="font-medium">Plan:</span> {subscription.planName} · {formatMoney(subscription.price)}
            </p>
            <p>
              <span className="font-medium">Subscription Start:</span> {formatDateTime(subscription.subscriptionStartAt)}
            </p>
            <p>
              <span className="font-medium">Renewal Date:</span> {formatDateTime(subscription.renewalDate)}
            </p>
          </div>
        )}

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <div key={plan._id || plan.key} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-xl font-bold text-slate-900">{plan.name}</h3>
            <p className="mt-2 text-3xl font-semibold text-teal-800">
              {formatMoney(plan.price, plan.currency)}
              <span className="text-sm font-normal text-slate-500">/{plan.billingCycle || "month"}</span>
            </p>
            <ul className="mt-4 space-y-2 text-sm text-slate-600">
              {(plan.features || []).map((feature) => (
                <li key={feature}>• {feature}</li>
              ))}
            </ul>
            <button
              type="button"
              disabled={Boolean(busyPlan) || (subscription?.status === "active" && subscription?.planName === plan.key)}
              onClick={() => upgrade(plan)}
              className="mt-5 w-full rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
            >
              {busyPlan === plan.key
                ? "Processing..."
                : subscription?.status === "active" && subscription?.planName === plan.key
                  ? "Current plan"
                  : subscription?.status === "expired"
                    ? "Upgrade Subscription"
                    : "Upgrade Now"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BillingPage;
