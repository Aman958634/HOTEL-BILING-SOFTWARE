import { useForm } from "react-hook-form";
import { createUser } from "../../services/superAdminService";
import PasswordInput from "../../components/common/PasswordInput";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

const USER_ROLES = [
  "super_admin",
  "hotel_admin",
  "restaurant_admin",
  "manager",
  "staff",
  "cashier",
  "admin",
  "chef",
  "waiter",
  "delivery",
  "receptionist",
  "inventory_manager",
  "customer",
];

const AddUserPage = () => {
  const { register, handleSubmit } = useForm({ defaultValues: { role: "customer", isActive: true } });
  const navigate = useNavigate();

  const onSubmit = async (values) => {
    try {
      await createUser(values);
      toast.success("User created successfully.");
      navigate("/super-admin/users");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Unable to create user");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-white p-6 rounded shadow">
      <h2 className="text-2xl font-bold mb-4">Create User</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <input {...register("fullName")} placeholder="Full Name" className="border p-2" required />
        <input {...register("email")} placeholder="Email" className="border p-2" type="email" required />
        <input {...register("phone")} placeholder="Phone" className="border p-2" />
        <input {...register("password")} placeholder="Password" className="border p-2" type="password" required />
        <select {...register("role")} className="border p-2">
          {USER_ROLES.map((role) => (
            <option key={role} value={role}>{role.replaceAll("_", " ")}</option>
          ))}
        </select>
        <select {...register("isActive")} className="border p-2">
          <option value={true}>Active</option>
          <option value={false}>Inactive</option>
        </select>
        <input {...register("restaurant")} placeholder="Restaurant ID" className="border p-2" />
        <input {...register("hotelId")} placeholder="Hotel ID" className="border p-2" />
      </div>
      <div className="mt-4">
        <button type="submit" className="btn bg-teal-700 text-white px-4 py-2 rounded">Create User</button>
      </div>
    </form>
  );
};

export default AddUserPage;
