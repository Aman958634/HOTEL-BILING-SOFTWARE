import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useForm } from "react-hook-form";
import PasswordInput from "../../components/common/PasswordInput";
import Button from "../../components/ui/Button";
import { requestPasswordResetOtp, resetPasswordWithOtp, verifyPasswordResetOtp } from "../../services/authService";

const RESEND_SECONDS = 60;
const fieldClass = "h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20";

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [step, setStep] = useState("email");
  const [verificationToken, setVerificationToken] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [submitError, setSubmitError] = useState("");
  const [updated, setUpdated] = useState(false);
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm();

  useEffect(() => {
    if (!cooldown) return undefined;
    const timer = window.setInterval(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const sendCode = async () => {
    setSubmitError("");
    try {
      const response = await requestPasswordResetOtp(email.trim());
      const seconds = Number(response?.data?.data?.resendCooldownSeconds || RESEND_SECONDS);
      setCooldown(seconds);
      setStep("otp");
      toast.success("If an account exists, a verification code has been sent.");
    } catch (error) {
      setSubmitError(error?.response?.data?.message || "Unable to send a verification code. Please try again.");
    }
  };

  const verifyCode = async ({ otp }) => {
    setSubmitError("");
    try {
      const response = await verifyPasswordResetOtp(email.trim(), otp);
      setVerificationToken(response?.data?.data?.verificationToken || "");
      setStep("password");
    } catch (error) {
      setSubmitError(error?.response?.data?.message || "That code is invalid or expired.");
    }
  };

  const savePassword = async ({ password }) => {
    setSubmitError("");
    try {
      await resetPasswordWithOtp(email.trim(), verificationToken, password);
      setUpdated(true);
      toast.success("Password updated successfully.");
      window.setTimeout(() => navigate("/login", { replace: true }), 1400);
    } catch (error) {
      setSubmitError(error?.response?.data?.message || "Unable to update your password. Please request a new code.");
    }
  };

  const resendCode = async () => {
    if (cooldown > 0) return;
    await sendCode();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/60 sm:p-8">
        <div className="text-center">
          <img src="/restosphere-logo.png" alt="" className="mx-auto h-12 w-12" width="48" height="48" />
          <h1 className="mt-4 text-2xl font-bold text-slate-900">Reset your password</h1>
          <p className="mt-2 text-sm text-slate-600">Verify your registered email to create a new RestoSphere password.</p>
        </div>

        {updated ? <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" role="status">Password Updated Successfully. Redirecting to login...</div> : null}

        {!updated && step === "email" ? <form onSubmit={(event) => { event.preventDefault(); void sendCode(); }} className="mt-6 space-y-4">
          <div>
            <label htmlFor="registered-email" className="mb-1.5 block text-sm font-medium text-slate-800">Registered email</label>
            <input id="registered-email" type="email" autoComplete="email" className={fieldClass} placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} />
          </div>
          <Button type="submit" loading={isSubmitting} loadingText="Sending code..." className="w-full">Send verification code</Button>
        </form> : null}

        {!updated && step === "otp" ? <form onSubmit={handleSubmit(verifyCode)} className="mt-6 space-y-4">
          <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">A six-digit code was sent to <strong className="break-all text-slate-900">{email}</strong>.</div>
          <div>
            <label htmlFor="reset-otp" className="mb-1.5 block text-sm font-medium text-slate-800">Verification code</label>
            <input id="reset-otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} className={`${fieldClass} text-center text-xl tracking-[0.35em]`} {...register("otp", { required: "Enter the verification code.", pattern: { value: /^\d{6}$/, message: "Enter the six-digit verification code." } })} />
            {errors.otp ? <p className="mt-1 text-sm text-rose-600" role="alert">{errors.otp.message}</p> : null}
          </div>
          <Button type="submit" loading={isSubmitting} loadingText="Verifying..." className="w-full">Verify code</Button>
          <button type="button" onClick={() => void resendCode()} disabled={cooldown > 0 || isSubmitting} className="w-full text-sm font-semibold text-brand-700 disabled:cursor-not-allowed disabled:text-slate-400">{cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}</button>
        </form> : null}

        {!updated && step === "password" ? <form onSubmit={handleSubmit(savePassword)} className="mt-6 space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">Email verified. Choose a new password with at least 8 characters.</div>
          <div>
            <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-slate-800">New password</label>
            <PasswordInput id="new-password" autoComplete="new-password" className={fieldClass} {...register("password", { required: "Password is required.", minLength: { value: 8, message: "Password must be at least 8 characters." }, maxLength: { value: 128, message: "Password must be 128 characters or fewer." } })} />
            {errors.password ? <p className="mt-1 text-sm text-rose-600" role="alert">{errors.password.message}</p> : null}
          </div>
          <div>
            <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium text-slate-800">Confirm new password</label>
            <PasswordInput id="confirm-password" autoComplete="new-password" className={fieldClass} {...register("confirmPassword", { required: "Please confirm your password.", validate: (value) => value === watch("password") || "Passwords do not match." })} />
            {errors.confirmPassword ? <p className="mt-1 text-sm text-rose-600" role="alert">{errors.confirmPassword.message}</p> : null}
          </div>
          <Button type="submit" loading={isSubmitting} loadingText="Saving password..." className="w-full">Save new password</Button>
        </form> : null}

        {submitError ? <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700" role="alert">{submitError}</p> : null}
        <Link to="/login" className="mt-6 block text-center text-sm font-semibold text-brand-700 hover:underline">Back to login</Link>
      </section>
    </main>
  );
};

export default ForgotPasswordPage;
