import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import { fetchPublicPlans, parsePublicPlansResponse } from "../../services/publicSubscriptionService";
import { saveSelectedPlan } from "../../utils/planSelection";

const formatMoney = (amount, currency = "INR") => {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  } catch {
    return `₹${amount || 0}`;
  }
};

const FREE_TRIAL_FEATURES = [
  "Full access to core restaurant/hotel management features",
  "Dashboard",
  "Orders",
  "Billing",
  "Payments",
  "Reports",
  "Basic subscription features",
  "No payment required during trial",
];

const PricingPage = () => {
  const navigate = useNavigate();
  const { accessToken, user } = useSelector((state) => state.auth);
  const [plans, setPlans] = useState([]);
  const [trialDays, setTrialDays] = useState(15);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const loadIdRef = useRef(0);

  const loadPlans = useCallback(async () => {
    const requestId = ++loadIdRef.current;
    setLoading(true);
    setError("");
    try {
      const { data } = await fetchPublicPlans();
      if (requestId !== loadIdRef.current) return;
      const { plans: list, trialDays: days } = parsePublicPlansResponse(data);
      setPlans(list);
      setTrialDays(days);
      if (!list.length) {
        setError("Unable to load plans. Please try again.");
      }
    } catch (_err) {
      if (requestId !== loadIdRef.current) return;
      setPlans([]);
      setError("Unable to load plans. Please try again.");
    } finally {
      if (requestId === loadIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const sortedPlans = useMemo(
    () => [...plans].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)),
    [plans]
  );

  const handleTrialSignup = () => {
    setBusyKey("trial");
    saveSelectedPlan("trial");

    const isAdmin = user?.role === "admin";
    const hasRestaurant = Boolean(user?.restaurant);

    if (accessToken && isAdmin && hasRestaurant) {
      toast.success("You already have a restaurant account. Manage your subscription from the dashboard.");
      navigate("/dashboard/admin/my-subscription");
      return;
    }

    if (accessToken && isAdmin && !hasRestaurant) {
      navigate("/subscribe/register", { state: { selectedPlan: "trial" } });
      return;
    }

    if (accessToken && !isAdmin) {
      toast("Restaurant owner account required. Please register your restaurant.", { icon: "ℹ️" });
      navigate("/subscribe/register", { state: { selectedPlan: "trial" } });
      return;
    }

    navigate("/subscribe/register", { state: { selectedPlan: "trial" } });
  };

  const selectPlan = (plan) => {
    setBusyKey(plan.key);
    saveSelectedPlan(plan.key);

    const isAdmin = user?.role === "admin";
    const hasRestaurant = Boolean(user?.restaurant);

    if (accessToken && isAdmin && hasRestaurant) {
      navigate("/subscribe/checkout");
      return;
    }

    if (accessToken && isAdmin && !hasRestaurant) {
      navigate("/subscribe/register");
      return;
    }

    if (accessToken && !isAdmin) {
      toast("Restaurant owner account required. Please register your restaurant.", { icon: "ℹ️" });
      navigate("/subscribe/register");
      return;
    }

    navigate("/subscribe/register", {
      state: { selectedPlan: plan.key },
    });
  };

  return (
    <div className="pb-10">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal-700">Pricing</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 md:text-4xl">Simple plans for every restaurant</h1>
        <p className="mt-3 text-slate-600">
          Start with a {trialDays}-day free trial after signup, then activate your plan with secure Razorpay payment.
        </p>
      </div>

      {loading && (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-80 animate-pulse rounded-2xl bg-slate-200/70" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="mx-auto mt-10 max-w-md rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <p className="font-semibold text-rose-800">{error}</p>
          <button
            type="button"
            onClick={loadPlans}
            className="mt-4 rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
          >
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col rounded-2xl border border-emerald-300 bg-white p-6 shadow-sm ring-1 ring-emerald-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold uppercase tracking-wide text-slate-900">Free Trial</h2>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">No card</span>
            </div>
            <p className="mt-4 text-3xl font-semibold text-teal-800">
              {formatMoney(0)}
              <span className="text-sm font-normal text-slate-500"> / {trialDays} days</span>
            </p>
            <p className="mt-2 text-sm text-slate-500">Perfect for trying RestoSphere</p>
            <ul className="mt-5 flex-1 space-y-2 text-sm text-slate-600">
              {FREE_TRIAL_FEATURES.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <span className="text-teal-700">✓</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={Boolean(busyKey)}
              onClick={handleTrialSignup}
              className="mt-6 w-full rounded-xl border-2 border-teal-700 bg-white px-4 py-3 text-sm font-semibold text-teal-800 hover:bg-teal-50 disabled:opacity-60"
            >
              {busyKey === "trial" ? "Continuing..." : "Start Free Trial"}
            </button>
          </div>

          {sortedPlans.map((plan) => (
            <div
              key={plan.key || plan.name}
              className={`flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${
                plan.key === "professional" ? "border-teal-500 ring-1 ring-teal-500" : "border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold uppercase tracking-wide text-slate-900">{plan.name}</h2>
                {plan.key === "professional" && (
                  <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-800">Popular</span>
                )}
              </div>
              <p className="mt-4 text-3xl font-semibold text-teal-800">
                {formatMoney(plan.price, plan.currency)}
                <span className="text-sm font-normal text-slate-500"> / month</span>
              </p>
              {plan.description ? <p className="mt-2 text-sm text-slate-500">{plan.description}</p> : null}
              <ul className="mt-5 flex-1 space-y-2 text-sm text-slate-600">
                {(plan.features || []).map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span className="text-teal-700">✓</span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                disabled={Boolean(busyKey)}
                onClick={() => selectPlan(plan)}
                className="mt-6 w-full rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
              >
                {busyKey === plan.key ? "Continuing..." : "Select Plan"}
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="mt-8 text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link to="/login" state={{ from: { pathname: "/subscribe/checkout" } }} className="font-semibold text-teal-700 hover:underline">
          Login to continue
        </Link>
      </p>
    </div>
  );
};

export default PricingPage;
