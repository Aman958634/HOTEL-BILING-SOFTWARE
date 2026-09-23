import { useForm } from "react-hook-form";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useState } from "react";
import PasswordInput from "../../components/common/PasswordInput";
import { resetPassword } from "../../services/authService";
import Button from "../../components/ui/Button";

const ResetPasswordPage = () => {
  const { token } = useParams();
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm();
  const [completed, setCompleted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const onSubmit = async ({ password }) => {
    setSubmitError("");
    try {
      await resetPassword(token, password);
      setCompleted(true);
      toast.success("Password reset. Please sign in.");
    } catch (error) {
      const message = error?.response?.data?.message || "This reset link is invalid or has expired.";
      setSubmitError(message);
      toast.error(message);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl shadow-slate-200/60">
        <h1 className="text-2xl font-bold text-slate-900">Choose a new password</h1>
        <p className="mt-2 text-sm text-slate-600">Use at least eight characters. This link expires after 30 minutes.</p>
        {!token ? <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800" role="alert">This reset link is invalid. Request a new password reset email.</div> : null}
        {completed ? <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">Your password has been reset. You can now sign in.</div> : token ? <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
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
          <Button type="submit" loading={isSubmitting} loadingText="Saving…" disabled={!token} className="w-full">Reset password</Button>
        </form> : null}
        {submitError ? <p className="mt-4 text-sm text-rose-700" role="alert">{submitError}</p> : null}
        <Link to={completed ? "/login" : "/forgot-password"} className="mt-5 inline-block text-sm font-medium text-brand-700 hover:underline">{completed ? "Go to login" : "Request a new reset link"}</Link>
      </section>
    </main>
  );
};

export default ResetPasswordPage;
