import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  convertSubscription,
  createSubscriptionCheckout,
  verifySubscriptionPayment,
} from "../../services/superAdminService";

const formatMoney = (amount, currency = "INR") => {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount || 0);
  } catch {
    return `₹${amount || 0}`;
  }
};

const formatDate = (value) => (value ? new Date(value).toLocaleDateString("en-IN") : "—");

const SAAS_PLAN_KEYS = ["basic", "professional", "enterprise"];

const PlanCard = ({ plan, selected, onSelect }) => (
  <div
    className={`rounded-xl border p-5 transition ${
      selected ? "border-teal-600 bg-teal-50 ring-2 ring-teal-600" : "border-slate-200 bg-white"
    }`}
  >
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-lg font-bold text-slate-900">{plan.name}</p>
        <p className="mt-1 text-2xl font-semibold text-teal-800">
          {formatMoney(plan.price, plan.currency)}
          <span className="text-sm font-normal text-slate-500"> / month</span>
        </p>
      </div>
      {selected && (
        <span className="rounded-full bg-teal-700 px-2 py-0.5 text-xs font-semibold text-white">Selected</span>
      )}
    </div>
    <p className="mt-3 text-sm text-slate-600">{(plan.features || []).slice(0, 3).join(" · ")}</p>
    <button
      type="button"
      onClick={() => onSelect(plan)}
      className={`mt-4 w-full rounded-lg px-4 py-2 text-sm font-semibold transition ${
        selected
          ? "bg-teal-700 text-white"
          : "border border-teal-700 text-teal-800 hover:bg-teal-50"
      }`}
    >
      Select Plan
    </button>
  </div>
);

const SelectPlanModal = ({ open, subscription, plans, onClose, onComplete }) => {
  const [step, setStep] = useState("select");
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [paymentSummary, setPaymentSummary] = useState(null);
  const [checkout, setCheckout] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const displayPlans = useMemo(
    () => plans.filter((p) => SAAS_PLAN_KEYS.includes(p.key)).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
    [plans]
  );

  useEffect(() => {
    if (!open) return;
    setStep("select");
    setSelectedPlan(null);
    setPaymentSummary(null);
    setCheckout(null);
    setBusy(false);
    setError("");

    const preselected = displayPlans.find(
      (p) => p.key === subscription?.metadata?.selectedPaidPlan || p.key === subscription?.planName
    );
    if (preselected) setSelectedPlan(preselected);
  }, [open, subscription, displayPlans]);

  const hotelName = subscription?.restaurant?.name || "Hotel";

  if (!open || !subscription) return null;

  const handleContinueToPayment = async () => {
    if (!selectedPlan) return;
    setBusy(true);
    setError("");
    try {
      const { data } = await convertSubscription(subscription._id, selectedPlan.key, selectedPlan._id);
      const payload = data?.data;
      setPaymentSummary(payload?.paymentSummary || null);
      setSelectedPlan(payload?.selectedPlan || selectedPlan);
      setStep("summary");
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to save plan selection");
      toast.error(err?.response?.data?.message || "Failed to save plan selection");
    } finally {
      setBusy(false);
    }
  };

  const handlePayNow = async () => {
    setBusy(true);
    setError("");
    setStep("processing");
    try {
      const { data } = await createSubscriptionCheckout(subscription._id);
      const payload = data?.data;
      setCheckout(payload);
      if (payload?.paymentSummary) setPaymentSummary(payload.paymentSummary);

      if (payload?.testMode) {
        setStep("pay-test");
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
        key: payload.keyId,
        amount: Math.round(Number(payload.amount) * 100),
        currency: payload.currency || "INR",
        name: "RestoSphere",
        description: `${payload.plan?.name || "Plan"} subscription`,
        order_id: payload.razorpayOrderId,
        handler: async (response) => {
          try {
            setStep("processing");
            await verifySubscriptionPayment(subscription._id, {
              paymentId: payload.paymentId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            setStep("success");
            toast.success("Payment Successful — Subscription Activated");
            onComplete?.();
          } catch (err) {
            setStep("failed");
            setError(err?.response?.data?.message || "Payment verification failed");
            toast.error(err?.response?.data?.message || "Payment failed");
          }
        },
        modal: {
          ondismiss: () => {
            setStep("summary");
            setBusy(false);
            toast.error("Payment cancelled");
          },
        },
      });
      rzp.open();
    } catch (err) {
      setStep("failed");
      setError(err?.response?.data?.message || "Failed to start payment");
      toast.error(err?.response?.data?.message || "Failed to start payment");
    } finally {
      setBusy(false);
    }
  };

  const handleTestPayment = async (success) => {
    if (!checkout?.paymentId) return;
    setBusy(true);
    setError("");
    setStep("processing");
    try {
      if (success) {
        await verifySubscriptionPayment(subscription._id, {
          paymentId: checkout.paymentId,
          testSuccess: true,
        });
        setStep("success");
        toast.success("Payment Successful — Subscription Activated");
        onComplete?.();
      } else {
        setStep("failed");
        setError("Payment failed. Subscription remains expired until payment succeeds.");
        toast.error("Payment failed");
      }
    } catch (err) {
      setStep("failed");
      setError(err?.response?.data?.message || "Payment failed");
      toast.error(err?.response?.data?.message || "Payment failed");
    } finally {
      setBusy(false);
    }
  };

  const stepTitle = {
    select: "Select Paid Plan",
    summary: "Payment Summary",
    processing: "Payment Processing",
    "pay-test": "Payment Summary",
    success: "Payment Successful",
    failed: "Payment Failed",
  }[step];

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <h3 className="text-xl font-bold text-slate-900">{stepTitle}</h3>
          <p className="mt-1 text-sm text-slate-500">
            {hotelName} · {String(subscription.status || "").toUpperCase()}
          </p>
          {step === "select" && (
            <p className="mt-2 text-sm text-amber-800">
              Selecting a plan does not activate the subscription or record payment.
            </p>
          )}
          {checkout?.testMode && step === "pay-test" && (
            <p className="mt-2 inline-block rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900">
              TEST/DEVELOPMENT MODE — No real payment will be processed
            </p>
          )}
        </div>

        <div className="space-y-4 px-6 py-5">
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>
          )}

          {step === "select" && (
            <>
              {displayPlans.length === 0 ? (
                <p className="text-sm text-slate-500">Loading paid plans...</p>
              ) : (
                <div className="grid gap-4 md:grid-cols-3">
                  {displayPlans.map((plan) => (
                    <PlanCard
                      key={plan._id || plan.key}
                      plan={plan}
                      selected={selectedPlan?.key === plan.key}
                      onSelect={setSelectedPlan}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {(step === "summary" || step === "pay-test" || step === "processing") && paymentSummary && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-3 text-sm">
              <div className="grid gap-3 md:grid-cols-2">
                <p><span className="font-medium text-slate-500">Hotel / Restaurant</span><br />{paymentSummary.restaurantName || hotelName}</p>
                <p><span className="font-medium text-slate-500">Selected Plan</span><br />{paymentSummary.planName || selectedPlan?.name}</p>
                <p><span className="font-medium text-slate-500">Billing Period</span><br />{paymentSummary.billingPeriod || "Monthly"}</p>
                <p><span className="font-medium text-slate-500">Amount</span><br />{formatMoney(paymentSummary.amount, paymentSummary.currency)}</p>
                <p><span className="font-medium text-slate-500">Subscription Start</span><br />{formatDate(paymentSummary.subscriptionStartPreview)}</p>
                <p><span className="font-medium text-slate-500">Next Renewal</span><br />{formatDate(paymentSummary.renewalDatePreview)}</p>
              </div>
            </div>
          )}

          {step === "processing" && (
            <div className="flex flex-col items-center py-8 text-slate-600">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-teal-200 border-t-teal-700" />
              <p className="mt-4 font-medium">Processing payment...</p>
            </div>
          )}

          {step === "pay-test" && (
            <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 p-4">
              <p className="text-sm text-amber-900">Development test mode. Choose a simulated outcome:</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleTestPayment(true)}
                  className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
                >
                  Pay Now (Test Success)
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => handleTestPayment(false)}
                  className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-50 disabled:opacity-60"
                >
                  Simulate Failed Payment
                </button>
              </div>
            </div>
          )}

          {step === "success" && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
              <p className="text-lg font-bold text-emerald-900">Payment Successful</p>
              <p className="mt-2 text-sm text-emerald-800">Subscription Activated</p>
              <p className="mt-1 text-sm text-slate-600">
                {paymentSummary?.planName} · Renews {formatDate(paymentSummary?.renewalDatePreview)}
              </p>
            </div>
          )}

          {step === "failed" && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-center">
              <p className="text-lg font-bold text-rose-900">Payment Failed</p>
              <p className="mt-2 text-sm text-rose-800">The subscription was not activated.</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
          {step === "success" ? (
            <button
              type="button"
              onClick={() => { onClose(); onComplete?.(); }}
              className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
            >
              Done
            </button>
          ) : (
            <>
              <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">
                Cancel
              </button>

              {step === "select" && (
                <button
                  type="button"
                  disabled={!selectedPlan || busy}
                  onClick={handleContinueToPayment}
                  className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? "Saving..." : "Continue to Payment"}
                </button>
              )}

              {step === "summary" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handlePayNow}
                  className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
                >
                  Pay Now
                </button>
              )}

              {step === "failed" && (
                <button
                  type="button"
                  onClick={() => setStep("summary")}
                  className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
                >
                  Try Again
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SelectPlanModal;
