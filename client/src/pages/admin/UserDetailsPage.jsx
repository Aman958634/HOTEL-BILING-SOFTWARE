import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getUser, updateUser, updateUserStatus } from "../../services/superAdminService";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

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

const UserDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { register, handleSubmit, setValue } = useForm();
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  const loadUser = async () => {
    setLoading(true);
    try {
      const { data } = await getUser(id);
      setUser(data.data || data);
      const userData = data.data || data;
      setValue("fullName", userData.fullName || "");
      setValue("email", userData.email || "");
      setValue("phone", userData.phone || "");
      setValue("role", userData.role || "customer");
      setValue("isActive", userData.isActive);
      setValue("restaurant", userData.restaurant || "");
      setValue("hotelId", userData.hotelId || "");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Unable to load user");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();
  }, [id]);

  const onSubmit = async (values) => {
    try {
      await updateUser(id, values);
      toast.success("User updated successfully");
      navigate("/super-admin/users");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Unable to update user");
    }
  };

  const toggleStatus = async () => {
    if (!user) return;
    try {
      await updateUserStatus(id, user.isActive ? "inactive" : "active");
      toast.success(`User ${user.isActive ? "deactivated" : "activated"}`);
      loadUser();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Unable to update status");
    }
  };

  if (loading) {
    return <p>Loading user details...</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">User Details</h2>
          <p className="text-sm text-slate-500">View and update the selected user profile.</p>
        </div>
        <button onClick={() => navigate("/super-admin/users")} className="btn rounded border border-slate-300 px-4 py-2">
          Back to users
        </button>
      </div>
      {user ? (
        <form onSubmit={handleSubmit(onSubmit)} className="bg-white p-6 rounded shadow grid gap-4 md:grid-cols-2">
          <input {...register("fullName")} placeholder="Full Name" className="border p-2" required />
          <input {...register("email")} placeholder="Email" className="border p-2" type="email" required />
          <input {...register("phone")} placeholder="Phone" className="border p-2" />
          <input {...register("password")} placeholder="New Password" className="border p-2" type="password" />
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
          <div className="md:col-span-2 flex items-center gap-3 mt-2">
            <button type="submit" className="btn bg-teal-700 text-white px-4 py-2 rounded">Save changes</button>
            <button type="button" onClick={toggleStatus} className="btn rounded border border-slate-300 px-4 py-2">
              {user.isActive ? "Deactivate" : "Activate"}
            </button>
          </div>
        </form>
      ) : (
        <div className="bg-white rounded shadow p-6">User not found.</div>
      )}
    </div>
  );
};

export default UserDetailsPage;
