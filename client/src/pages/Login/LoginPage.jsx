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
  waiter: "/dashboard/waiter",
  delivery: "/dashboard/delivery",
  customer: "/dashboard/customer",
  manager: "/dashboard/customer",
  cashier: "/dashboard/customer",
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
  const { register, handleSubmit, setValue, formState: { isSubmitting } } = useForm();
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
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7F8FA]">
      <div className="flex min-h-screen flex-col lg:flex-row">
        {/* Left Branding Panel */}
        <div className="relative hidden lg:flex lg:w-[45%] xl:w-[40%] flex-col justify-between overflow-hidden bg-gradient-to-br from-[#EF1B1B] to-[#C90000] p-10 xl:p-14">
          <div className="absolute inset-0 opacity-[0.08]">
            <div className="absolute -top-24 -left-24 h-[420px] w-[420px] rounded-full border border-white" />
            <div className="absolute top-32 right-[-80px] h-[320px] w-[320px] rounded-full border border-white" />
            <div className="absolute bottom-[-60px] left-[20%] h-[260px] w-[260px] rounded-full border border-white" />
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                <span className="text-xl font-bold text-white">R</span>
              </div>
              <span className="text-xl font-bold text-white">RestoSphere</span>
            </div>
            <p className="mt-2 text-sm text-white/80">Restaurant Management Simplified</p>
          </div>

          <div className="relative z-10 max-w-md">
            <h1 className="text-4xl xl:text-5xl font-bold leading-tight text-white">
              Manage Your Restaurant Effortlessly
            </h1>
            <p className="mt-4 text-base leading-relaxed text-white/85">
              Login to access your dashboard and streamline your restaurant operations.
            </p>

            <div className="mt-10 space-y-5">
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur-sm">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Real-time Analytics</p>
                  <p className="mt-0.5 text-sm text-white/75">Track orders, revenue & performance</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur-sm">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Order Management</p>
                  <p className="mt-0.5 text-sm text-white/75">Manage orders seamlessly</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur-sm">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Customer Management</p>
                  <p className="mt-0.5 text-sm text-white/75">Build stronger customer relationships</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur-sm">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">Settings & More</p>
                  <p className="mt-0.5 text-sm text-white/75">Customize your restaurant settings</p>
                </div>
              </div>
            </div>
          </div>

          <div className="relative z-10 mt-10">
            <img
              src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&auto=format&fit=crop&q=80"
              alt="Premium restaurant dish"
              className="h-44 w-full rounded-2xl object-cover shadow-2xl"
              loading="lazy"
            />
            <p className="mt-3 text-xs text-white/70">Experience premium dining management</p>
          </div>
        </div>

        {/* Right Login Panel */}
        <div className="flex flex-1 items-center justify-center bg-[#F7F8FA] px-4 py-12 sm:px-6 lg:w-[55%] xl:w-[60%]">
          <div className="w-full max-w-[420px]">
            <div className="lg:hidden mb-8 text-center">
              <div className="inline-flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EF1B1B]">
                  <span className="text-xl font-bold text-white">R</span>
                </div>
                <span className="text-xl font-bold text-[#172033]">RestoSphere</span>
              </div>
              <p className="mt-1 text-sm text-[#6B7280]">Restaurant Management Simplified</p>
            </div>

            <div className="rounded-[20px] bg-white p-8 shadow-[0_25px_60px_-12px_rgba(0,0,0,0.08)] sm:p-10">
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-[#172033]">Welcome Back!</h2>
                <p className="mt-1.5 text-sm text-[#6B7280]">Login to your account to continue</p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-[#172033]">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                      <svg className="h-5 w-5 text-[#6B7280]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                      </svg>
                    </div>
                    <input
                      id="email"
                      type="email"
                      placeholder="Enter your email address"
                      className="h-[56px] w-full rounded-xl border border-[#E5E7EB] bg-white pl-11 pr-4 text-sm text-[#172033] outline-none transition-all placeholder:text-[#9CA3AF] focus:border-[#EF1B1B] focus:ring-[3px] focus:ring-[#EF1B1B]/10"
                      {...register("email", { required: true })}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-[#172033]">
                    Password
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                      <svg className="h-5 w-5 text-[#6B7280]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    </div>
                      <PasswordInput
                        id="password"
                        placeholder="Enter your password"
                        className="h-[56px] w-full rounded-xl border border-[#E5E7EB] bg-white pl-11 pr-10 text-sm text-[#172033] outline-none transition-all placeholder:text-[#9CA3AF] focus:border-[#EF1B1B] focus:ring-[3px] focus:ring-[#EF1B1B]/10"
                        {...register("password", { required: true })}
                      />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-[#E5E7EB] text-[#EF1B1B] focus:ring-[#EF1B1B]/20"
                    />
                    <span className="text-sm text-[#6B7280]">Remember me</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => navigate("/forgot-password")}
                    className="text-sm font-medium text-[#EF1B1B] transition-colors hover:text-[#C90000]"
                  >
                    Forgot password?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-2 flex h-[56px] w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#EF1B1B] to-[#C90000] text-base font-semibold text-white shadow-lg shadow-[#EF1B1B]/25 transition-all hover:shadow-xl hover:shadow-[#EF1B1B]/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-80"
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
                <div className="h-px flex-1 bg-[#E5E7EB]" />
                <span className="text-xs text-[#6B7280]">or continue with</span>
                <div className="h-px flex-1 bg-[#E5E7EB]" />
              </div>

              <p className="mt-6 text-center text-sm text-[#6B7280]">
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
    </div>
  );
};

export default LoginPage;
