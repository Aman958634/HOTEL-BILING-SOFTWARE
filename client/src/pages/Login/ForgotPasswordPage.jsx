import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { requestPasswordReset } from "../../services/authService";

const ForgotPasswordPage = () => {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();
  const onSubmit = async ({ email }) => {
    try {
      await requestPasswordReset(String(email || "").trim());
      toast.success("If an account exists, a reset link has been sent.");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to request a password reset");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl shadow-slate-200/60">
        <h1 className="text-2xl font-bold text-slate-900">Reset your password</h1>
        <p className="mt-2 text-sm text-slate-600">Enter your account email and we’ll send a reset link if the account exists.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4">
          <div>
            <label htmlFor="reset-email" className="mb-1 block text-sm font-medium text-slate-800">Email address</label>
            <input id="reset-email" type="email" autoComplete="email" className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20" {...register("email", { required: "Email address is required." })} />
            {errors.email ? <p className="mt-1 text-sm text-rose-600" role="alert">{errors.email.message}</p> : null}
          </div>
          <button type="submit" disabled={isSubmitting} className="w-full rounded-xl bg-brand-700 px-4 py-2.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
            {isSubmitting ? "Sending…" : "Send reset link"}
          </button>
        </form>
        <Link to="/login" className="mt-5 inline-block text-sm font-medium text-brand-700 hover:underline">Back to login</Link>
      </section>
    </main>
  );
};

export default ForgotPasswordPage;
