import { useForm } from "react-hook-form";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { registerThunk } from "../../redux/slices/authSlice";
import PasswordInput from "../../components/common/PasswordInput";

const RegisterPage = () => {
  const {
    register,
    handleSubmit,
    watch,
    formState: { isSubmitting, errors },
  } = useForm();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const passwordValue = watch("password");

  const onSubmit = async (values) => {
    try {
      await dispatch(registerThunk(values)).unwrap();
      toast.success("Registration successful");
      navigate("/login", {
        replace: true,
        state: {
          fromRegister: true,
          email: values.email,
        },
      });
    } catch (error) {
      const message = typeof error === "string" ? error : error?.message || "Registration failed";
      toast.error(message);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#F7F8FA]">
      <div className="flex min-h-screen w-full items-center justify-center px-4 py-10">
        <div className="w-full max-w-[480px]">
          <div className="rounded-[20px] bg-white px-8 py-10 shadow-[0_20px_60px_rgba(15,23,42,0.10)] sm:px-10">
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#128277]">
                  <span className="text-xl font-bold text-white">R</span>
                </div>
                <span className="text-[24px] font-bold text-[#172033]">RestoSphere</span>
              </div>
              <p className="mt-1.5 text-[13px] text-[#64748B]">Restaurant Management Simplified</p>
            </div>

            <div className="mt-7 text-center">
              <h1 className="text-[28px] font-bold text-[#172033]">Create your account</h1>
              <p className="mt-1.5 text-sm text-[#64748B]">Join RestoSphere and start managing your restaurant effortlessly.</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="mt-7">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="fullName" className="mb-1.5 block text-[13px] font-semibold text-[#172033]">
                    Full Name
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                      <svg className="h-4.5 w-4.5 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.25h15.003c.966 0 1.75-.783 1.75-1.75v-7.5c0-.966-.784-1.75-1.75-1.75h-1.5a.75.75 0 01-.75-.75v-.5a2.25 2.25 0 00-2.25-2.25h-1.5a2.25 2.25 0 00-2.25 2.25v.5a.75.75 0 01-.75.75h-1.5a1.75 1.75 0 01-1.75-1.75v-7.5a1.75 1.75 0 00-1.75-1.75h-1.5a1.75 1.75 0 00-1.75 1.75v7.5c0 .966-.784 1.75-1.75 1.75h-1.5a.75.75 0 01-.75-.75v-.5a2.25 2.25 0 00-2.25-2.25h-1.5a2.25 2.25 0 00-2.25 2.25v.5a.75.75 0 01-.75.75h-1.5z" />
                      </svg>
                    </div>
                    <input
                      id="fullName"
                      type="text"
                      placeholder="Enter your full name"
                      className="h-[52px] w-full rounded-xl border border-[#E1E7EE] bg-white pl-10 pr-3 text-sm text-[#172033] outline-none transition-all placeholder:text-[#94A3B8] focus:border-[#128277] focus:ring-[3px] focus:ring-[#128277]/10"
                      {...register("fullName", {
                        required: "Full name is required",
                        minLength: { value: 2, message: "Name must be at least 2 characters" },
                      })}
                    />
                  </div>
                  {errors.fullName && <p className="mt-1.5 text-xs text-rose-600">{errors.fullName.message}</p>}
                </div>

                <div>
                  <label htmlFor="email" className="mb-1.5 block text-[13px] font-semibold text-[#172033]">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                      <svg className="h-4.5 w-4.5 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                      </svg>
                    </div>
                    <input
                      id="email"
                      type="email"
                      placeholder="Enter your email address"
                      className="h-[52px] w-full rounded-xl border border-[#E1E7EE] bg-white pl-10 pr-3 text-sm text-[#172033] outline-none transition-all placeholder:text-[#94A3B8] focus:border-[#128277] focus:ring-[3px] focus:ring-[#128277]/10"
                      {...register("email", {
                        required: "Email is required",
                        pattern: {
                          value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                          message: "Enter a valid email",
                        },
                      })}
                    />
                  </div>
                  {errors.email && <p className="mt-1.5 text-xs text-rose-600">{errors.email.message}</p>}
                </div>

                <div>
                  <label htmlFor="phone" className="mb-1.5 block text-[13px] font-semibold text-[#172033]">
                    Phone Number
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                      <svg className="h-4.5 w-4.5 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 12a9.75 9.75 0 11-19.5 0 9.75 9.75 0 0119.5 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9.75a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                      </svg>
                    </div>
                    <input
                      id="phone"
                      type="tel"
                      placeholder="Enter your phone number"
                      className="h-[52px] w-full rounded-xl border border-[#E1E7EE] bg-white pl-10 pr-3 text-sm text-[#172033] outline-none transition-all placeholder:text-[#94A3B8] focus:border-[#128277] focus:ring-[3px] focus:ring-[#128277]/10"
                      {...register("phone", {
                        required: "Phone is required",
                        pattern: {
                          value: /^\d{10}$/,
                          message: "Phone must be exactly 10 digits",
                        },
                      })}
                    />
                  </div>
                  {errors.phone && <p className="mt-1.5 text-xs text-rose-600">{errors.phone.message}</p>}
                </div>

                <div>
                  <label htmlFor="password" className="mb-1.5 block text-[13px] font-semibold text-[#172033]">
                    Password
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                      <svg className="h-4.5 w-4.5 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    </div>
                    <PasswordInput
                      id="password"
                      placeholder="Enter your password"
                      className="h-[52px] w-full rounded-xl border border-[#E1E7EE] bg-white pl-10 pr-10 text-sm text-[#172033] outline-none transition-all placeholder:text-[#94A3B8] focus:border-[#128277] focus:ring-[3px] focus:ring-[#128277]/10"
                      {...register("password", {
                        required: "Password is required",
                        minLength: { value: 8, message: "Password must be at least 8 characters" },
                      })}
                    />
                  </div>
                  {errors.password && <p className="mt-1.5 text-xs text-rose-600">{errors.password.message}</p>}
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="confirmPassword" className="mb-1.5 block text-[13px] font-semibold text-[#172033]">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5">
                      <svg className="h-4.5 w-4.5 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    </div>
                    <PasswordInput
                      id="confirmPassword"
                      placeholder="Re-enter your password"
                      className="h-[52px] w-full rounded-xl border border-[#E1E7EE] bg-white pl-10 pr-10 text-sm text-[#172033] outline-none transition-all placeholder:text-[#94A3B8] focus:border-[#128277] focus:ring-[3px] focus:ring-[#128277]/10"
                      {...register("confirmPassword", {
                        required: "Please confirm your password",
                        validate: (value) => value === passwordValue || "Passwords do not match",
                      })}
                    />
                  </div>
                  {errors.confirmPassword && <p className="mt-1.5 text-xs text-rose-600">{errors.confirmPassword.message}</p>}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="mt-5 flex h-[54px] w-full items-center justify-center rounded-xl bg-[#128277] text-[15px] font-semibold text-white shadow-lg shadow-[#128277]/25 transition-all hover:bg-[#0e6b5f] hover:shadow-xl hover:shadow-[#128277]/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-80"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Creating Account...
                  </span>
                ) : (
                  "Create Account"
                )}
              </button>
            </form>

            <p className="mt-5 text-center text-sm text-[#64748B]">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="font-semibold text-[#128277] transition-colors hover:text-[#0e6b5f]"
              >
                Login
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
