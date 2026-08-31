import { useForm } from "react-hook-form";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { loginThunk, logout } from "../../redux/slices/authSlice";
import { getSelectedPlan, saveSelectedPlan } from "../../utils/planSelection";
import PasswordInput from "../../components/common/PasswordInput";

const roleRedirectMap = {
  super_admin: "/super-admin/dashboard",
  admin: "/dashboard/admin",
  chef: "/dashboard/chef",
  waiter: "/dashboard/service",
  delivery: "/dashboard/delivery",
  customer: "/dashboard/customer",
  manager: "/dashboard/service",
  cashier: "/dashboard/service",
};

const resolvePostLoginPath = (role, location) => {
  const fromPath = location.state?.from?.pathname;
  const selectedPlan = location.state?.selectedPlan || getSelectedPlan();
  if (selectedPlan) saveSelectedPlan(selectedPlan);

  if (selectedPlan && role === "admin") {
    return "/subscribe/checkout";
  }
  if (selectedPlan && role !== "admin" && role !== "super_admin") {
    return "/subscribe/register";
  }
  return fromPath || roleRedirectMap[role] || "/";
};

const LoginPage = ({ superAdminOnly = false }) => {
  const { register, handleSubmit, setValue, setError, clearErrors, formState: { errors, isSubmitting } } = useForm();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { accessToken, user } = useSelector((state) => state.auth);

  useEffect(() => {
    if (location.state?.selectedPlan) {
      saveSelectedPlan(location.state.selectedPlan);
    }
  }, [location.state]);

  useEffect(() => {
    if (location.state?.fromRegister) {
      if (location.state?.email) {
        setValue("email", location.state.email);
      }
      toast.success("Account created. Please login.");
      navigate(location.pathname, { replace: true, state: location.state?.selectedPlan ? { selectedPlan: location.state.selectedPlan } : null });
    }
  }, [location.pathname, location.state, navigate, setValue]);

  useEffect(() => {
    if (superAdminOnly && user && accessToken) {
      if (user.role !== "super_admin") {
        navigate(roleRedirectMap[user.role] || "/login", { replace: true });
      } else {
        navigate("/super-admin/dashboard", { replace: true });
      }
    }
  }, [accessToken, user, navigate, superAdminOnly]);

  const onSubmit = async (values) => {
    clearErrors("root");
    try {
      const result = await dispatch(
        loginThunk({
          email: String(values.email || "").trim(),
          password: String(values.password || ""),
        })
      ).unwrap();
      const role = result?.user?.role;

      if (superAdminOnly && role !== "super_admin") {
        dispatch(logout());
        toast.error("Only super admin users can login here.");
        return;
      }

      toast.success("Welcome back");
      navigate(resolvePostLoginPath(role, location), { replace: true });
    } catch (error) {
      const message = typeof error === "string" ? error : error?.message || "Invalid credentials";
      setError("root", { message: message === "Invalid credentials" ? "Your email or password is incorrect. Please try again." : message });
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F8FAFC]">
      <div className="flex min-h-screen w-full items-center justify-center px-4 py-10">
        <div className="w-full max-w-[500px]">
          <div className="rounded-[20px] bg-white px-8 py-10 shadow-[0_25px_60px_-12px_rgba(15,23,42,0.08)] sm:px-10">
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EF1B1B]">
                  <span className="text-xl font-bold text-white">R</span>
                </div>
                <span className="text-[26px] font-bold text-[#172033]">RestoSphere</span>
              </div>
              <p className="mt-2 text-sm text-[#64748B]">Restaurant Management Simplified</p>
            </div>

            <div className="mt-9 text-center">
              <h1 className="text-[32px] font-bold text-[#172033]">Welcome Back!</h1>
              <p className="mt-2 text-sm text-[#64748B]">Login to your account to continue</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-[#172033]">
                  Email Address
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    <svg className="h-5 w-5 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                  </div>
                  <input
                    id="email"
                    type="email"
                    placeholder="Enter your email address"
                    className="h-[56px] w-full rounded-xl border border-[#E2E8F0] bg-white pl-11 pr-4 text-sm text-[#172033] outline-none transition-all placeholder:text-[#94A3B8] focus:border-[#EF1B1B] focus:ring-[3px] focus:ring-[#EF1B1B]/10"
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? "email-error" : undefined}
                    {...register("email", { required: "Email address is required.", pattern: { value: /^\S+@\S+\.\S+$/, message: "Enter a valid email address." } })}
                  />
                </div>
                {errors.email ? <p id="email-error" className="mt-1.5 text-sm text-rose-600" role="alert">{errors.email.message}</p> : null}
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-[#172033]">
                  Password
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                    <svg className="h-5 w-5 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  </div>
                  <PasswordInput
                    id="password"
                    placeholder="Enter your password"
                    className="h-[56px] w-full rounded-xl border border-[#E2E8F0] bg-white pl-11 pr-10 text-sm text-[#172033] outline-none transition-all placeholder:text-[#94A3B8] focus:border-[#EF1B1B] focus:ring-[3px] focus:ring-[#EF1B1B]/10"
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? "password-error" : undefined}
                    {...register("password", { required: "Password is required." })}
                  />
                </div>
                {errors.password ? <p id="password-error" className="mt-1.5 text-sm text-rose-600" role="alert">{errors.password.message}</p> : null}
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-[#E2E8F0] text-[#EF1B1B] focus:ring-[#EF1B1B]/20"
                  />
                  <span className="text-sm text-[#475569]">Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  className="text-right text-xs font-medium text-[#EF1B1B] hover:text-[#C90000]"
                >
                  Forgot password?
                </button>
              </div>

              {errors.root ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{errors.root.message}</p> : null}

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-2 flex h-[56px] w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#EF1B1B] to-[#D90000] text-base font-semibold text-white shadow-lg shadow-[#EF1B1B]/25 transition-all hover:shadow-xl hover:shadow-[#EF1B1B]/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-80"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing In...
                  </span>
                ) : (
                  "Login"
                )}
              </button>
            </form>

            <div className="mt-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-[#E2E8F0]" />
              <span className="text-xs text-[#94A3B8]">or continue with</span>
              <div className="h-px flex-1 bg-[#E2E8F0]" />
            </div>

            <p className="mt-6 text-center text-sm text-[#475569]">
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => navigate("/register")}
                className="font-semibold text-[#EF1B1B] transition-colors hover:text-[#C90000]"
              >
                Sign up
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
