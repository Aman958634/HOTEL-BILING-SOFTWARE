import { useForm } from "react-hook-form";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { registerThunk } from "../../redux/slices/authSlice";

const RegisterPage = () => {
  const {
    register,
    handleSubmit,
    formState: { isSubmitting, errors },
  } = useForm();
  const dispatch = useDispatch();
  const navigate = useNavigate();

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
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-md glass rounded-2xl p-6">
      <h2 className="text-2xl font-bold">Register</h2>
      <input
        className="mt-4 w-full rounded-xl border p-3"
        placeholder="Full name"
        {...register("fullName", {
          required: "Full name is required",
          minLength: { value: 2, message: "Name must be at least 2 characters" },
        })}
      />
      {errors.fullName && <p className="mt-1 text-sm text-red-600">{errors.fullName.message}</p>}

      <input
        className="mt-3 w-full rounded-xl border p-3"
        placeholder="Email"
        {...register("email", {
          required: "Email is required",
          pattern: {
            value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
            message: "Enter a valid email",
          },
        })}
      />
      {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}

      <input
        className="mt-3 w-full rounded-xl border p-3"
        placeholder="Phone"
        {...register("phone", {
          required: "Phone is required",
          pattern: {
            value: /^\d{10}$/,
            message: "Phone must be exactly 10 digits",
          },
        })}
      />
      {errors.phone && <p className="mt-1 text-sm text-red-600">{errors.phone.message}</p>}

      <input
        className="mt-3 w-full rounded-xl border p-3"
        type="password"
        placeholder="Password"
        {...register("password", {
          required: "Password is required",
          minLength: { value: 8, message: "Password must be at least 8 characters" },
        })}
      />
      {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}

      <button disabled={isSubmitting} className="mt-4 w-full rounded-xl bg-brand-700 py-2 text-white disabled:cursor-not-allowed disabled:opacity-70">
        {isSubmitting ? "Creating..." : "Create Account"}
      </button>
    </form>
  );
};

export default RegisterPage;
