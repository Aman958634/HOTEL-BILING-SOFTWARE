import { useForm } from "react-hook-form";
import { createRestaurant } from "../../services/superAdminService";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

const AddRestaurantPage = () => {
  const { register, handleSubmit } = useForm();
  const navigate = useNavigate();

  const onSubmit = async (values) => {
    try {
      await createRestaurant(values);
      toast.success("Restaurant created");
      navigate("/super-admin/restaurants");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to create restaurant");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-white p-6 rounded shadow">
      <h2 className="text-2xl font-bold mb-4">Add Restaurant</h2>
      <div className="grid grid-cols-2 gap-4">
        <input {...register("name")} placeholder="Restaurant Name" className="border p-2" required />
        <input {...register("ownerName")} placeholder="Owner Name" className="border p-2" />
        <input {...register("adminFullName")} placeholder="Admin Full Name" className="border p-2" required />
        <input {...register("adminEmail")} placeholder="Admin Email" className="border p-2" type="email" required />
        <input {...register("phone")} placeholder="Phone" className="border p-2" />
        <input {...register("address")} placeholder="Address" className="border p-2" />
        <select {...register("plan")} className="border p-2">
          <option value="basic">Basic</option>
          <option value="professional">Professional</option>
          <option value="enterprise">Enterprise</option>
        </select>
        <select {...register("status")} className="border p-2">
          <option value="trial">Trial</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>
      <div className="mt-4">
        <button type="submit" className="btn bg-teal-700 text-white px-4 py-2 rounded">Create Restaurant</button>
      </div>
    </form>
  );
};

export default AddRestaurantPage;
