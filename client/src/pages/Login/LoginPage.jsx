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
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-md glass rounded-2xl p-6">
      <h2 className="text-2xl font-bold">{superAdminOnly ? "Super Admin Login" : "Login"}</h2>
      <p className="text-sm text-slate-500">{superAdminOnly ? "Use your super admin credentials to access the super-admin dashboard." : "Login with your account to continue."}</p>
      <input className="mt-4 w-full rounded-xl border p-3" placeholder="Email" {...register("email")} />
      <PasswordInput className="mt-3 w-full rounded-xl border p-3" placeholder="Password" {...register("password")} />
      <button disabled={isSubmitting} className="mt-4 w-full rounded-xl bg-brand-700 py-2 text-white disabled:cursor-not-allowed disabled:opacity-70">
        {isSubmitting ? "Signing In..." : superAdminOnly ? "Sign In as Super Admin" : "Sign In"}
      </button>
    </form>
  );
};

export default LoginPage;
