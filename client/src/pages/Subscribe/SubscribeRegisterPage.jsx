import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { publicSubscribeSignup, fetchPublicPlans, parsePublicPlansResponse } from "../../services/publicSubscriptionService";
import { getSelectedPlan, planDisplayName, saveSelectedPlan } from "../../utils/planSelection";
import { setAuthSession } from "../../redux/slices/authSlice";

const SubscribeRegisterPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { accessToken, user } = useSelector((state) => state.auth);

  const initialPlan = location.state?.selectedPlan || getSelectedPlan() || "basic";
  const [planKey, setPlanKey] = useState(initialPlan);
  const [plans, setPlans] = useState([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    ownerName: "",
    email: "",
    password: "",
    phone: "",
    restaurantName: "",
    address: "",
    city: "",
  });

  useEffect(() => {
    saveSelectedPlan(planKey);
  }, [planKey]);

  useEffect(() => {
    fetchPublicPlans()
      .then(({ data }) => {
        const { plans: list } = parsePublicPlansResponse(data);
        setPlans(list);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (accessToken && user?.role === "admin" && user?.restaurant) {
      navigate("/subscribe/checkout", { replace: true });
    }
  }, [accessToken, user, navigate]);

  const selectedPlan = useMemo(
    () => plans.find((p) => p.key === planKey) || { key: planKey, name: planDisplayName(planKey) },
    [plans, planKey]
  );

  const onChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const isTrialPlan = planKey === "trial";

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await publicSubscribeSignup({
        ...form,
        ownerName: form.ownerName || form.fullName,
        planName: planKey,
      });
      const payload = data?.data;
      if (!payload?.accessToken) throw new Error("Signup failed");

      localStorage.setItem("accessToken", payload.accessToken);
      if (payload.refreshToken) {
        localStorage.setItem("refreshToken", payload.refreshToken);
      }
      dispatch(
        setAuthSession({
          user: payload.user,
          accessToken: payload.accessToken,
          refreshToken: payload.refreshToken,
        })
      );

      saveSelectedPlan(planKey);
      if (isTrialPlan) {
        toast.success("Free trial started! Welcome to RestoSphere.");
        navigate("/dashboard/admin", { replace: true });
      } else {
        toast.success("Account created. Continue to payment.");
        navigate("/subscribe/checkout", { replace: true });
      }
    } catch (err) {
      toast.error(err?.response?.data?.message || err.message || "Registration failed");
    } finally {
      setBusy(false);
    }
  };

  const planOptions = useMemo(() => {
    const trialOption = { key: "trial", name: "Free Trial" };
    const paid = plans.length
      ? plans
      : [
          { key: "basic", name: "Basic" },
          { key: "professional", name: "Pro" },
          { key: "enterprise", name: "Premium" },
        ];
    return [trialOption, ...paid];
  }, [plans]);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold text-slate-900">Create your restaurant account</h1>
        <p className="mt-2 text-slate-600">
          Selected plan: <span className="font-semibold text-teal-800">{selectedPlan.name || planDisplayName(planKey)}</span>
        </p>
      </div>

      <form onSubmit={onSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="mb-4 block text-sm font-medium text-slate-700">
          Plan
          <select
            className="mt-1 w-full rounded-xl border border-slate-300 p-3"
            value={planKey}
            onChange={(e) => setPlanKey(e.target.value)}
          >
            {planOptions.map((p) => (
              <option key={p.key} value={p.key}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <div className="grid gap-3 md:grid-cols-2">
          <input name="fullName" required value={form.fullName} onChange={onChange} placeholder="Admin / Owner full name" className="rounded-xl border p-3" />
          <input name="ownerName" value={form.ownerName} onChange={onChange} placeholder="Owner name (optional)" className="rounded-xl border p-3" />
          <input name="email" type="email" required value={form.email} onChange={onChange} placeholder="Email" className="rounded-xl border p-3" />
          <input name="phone" required value={form.phone} onChange={onChange} placeholder="Phone" className="rounded-xl border p-3" />
          <input name="password" type="password" required minLength={8} value={form.password} onChange={onChange} placeholder="Password (min 8)" className="rounded-xl border p-3 md:col-span-2" />
          <input name="restaurantName" required value={form.restaurantName} onChange={onChange} placeholder="Restaurant name" className="rounded-xl border p-3 md:col-span-2" />
          <input name="address" required value={form.address} onChange={onChange} placeholder="Address" className="rounded-xl border p-3 md:col-span-2" />
          <input name="city" value={form.city} onChange={onChange} placeholder="City" className="rounded-xl border p-3 md:col-span-2" />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="mt-5 w-full rounded-xl bg-teal-700 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {busy ? "Creating account..." : isTrialPlan ? "Start Free Trial" : "Continue to Payment"}
        </button>

        <p className="mt-4 text-center text-sm text-slate-500">
          Already registered?{" "}
          <Link
            to="/login"
            state={{ from: { pathname: "/subscribe/checkout" }, selectedPlan: planKey }}
            className="font-semibold text-teal-700 hover:underline"
          >
            Login
          </Link>
        </p>
      </form>
    </div>
  );
};

export default SubscribeRegisterPage;
