import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import PasswordInput from "../../components/common/PasswordInput";
import { resetPassword } from "../../services/authService";

const ResetPasswordPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm();
  const onSubmit = async ({ password }) => {
    try {
      await resetPassword(token, password);
      toast.success("Password reset. Please sign in.");
      navigate("/login", { replace: true });
    } catch (error) {
      toast.error(error?.response?.data?.message || "This reset link is invalid or has expired.");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl shadow-slate-200/60">
        <h1 className="text-2xl font-bold text-slate-900">Choose a new password</h1>
        <p className="mt-2 text-sm text-slate-600">Use at least eight characters. This link expires after 30 minutes.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <div>
            <label htmlFor="new-password" className="mb-1 block text-sm font-medium text-slate-800">New password</label>
            <PasswordInput id="new-password" autoComplete="new-password" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20" {...register("password", { required: "Password is required.", minLength: { value: 8, message: "Password must be at least 8 characters." } })} />
            {errors.password ? <p className="mt-1 text-sm text-rose-600" role="alert">{errors.password.message}</p> : null}
          </div>
          <div>
            <label htmlFor="confirm-password" className="mb-1 block text-sm font-medium text-slate-800">Confirm password</label>
            <PasswordInput id="confirm-password" autoComplete="new-password" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20" {...register("confirmPassword", { required: "Please confirm your password.", validate: (value) => value === watch("password") || "Passwords do not match." })} />
            {errors.confirmPassword ? <p className="mt-1 text-sm text-rose-600" role="alert">{errors.confirmPassword.message}</p> : null}
          </div>
          <button type="submit" disabled={isSubmitting || !token} className="w-full rounded-xl bg-brand-700 px-4 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
            {isSubmitting ? "Saving…" : "Reset password"}
          </button>
        </form>
      </section>
    </main>
  );
};

export default ResetPasswordPage;
