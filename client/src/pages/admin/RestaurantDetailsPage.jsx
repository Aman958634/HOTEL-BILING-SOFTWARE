import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getRestaurant, updateRestaurant } from "../../services/superAdminService";
import toast from "react-hot-toast";

const RestaurantDetailsPage = () => {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const navigate = useNavigate();

  const load = async () => {
    try {
      const { data } = await getRestaurant(id);
      setData(data.data);
    } catch (err) { toast.error("Failed to load"); }
  };

  useEffect(() => { load(); }, [id]);

  const handleEdit = () => navigate("edit");

  if (!data) return <p>Loading...</p>;

  const { restaurant, admin, subscription, ordersCount, usersCount } = data;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">{restaurant.name}</h2>
          <p className="text-sm">Status: {restaurant.isActive ? "Active" : "Suspended"} • Plan: {subscription?.planName || "-"}</p>
        </div>
        <div>
          <button onClick={handleEdit} className="btn">Edit</button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="p-4 bg-white rounded shadow">
          <h4 className="font-bold">Overview</h4>
          <p>Total Orders: {ordersCount}</p>
          <p>Total Users: {usersCount}</p>
        </div>
        <div className="p-4 bg-white rounded shadow">
          <h4 className="font-bold">Restaurant Information</h4>
          <p>Name: {restaurant.name}</p>
          <p>Owner: {restaurant.ownerName || "-"}</p>
          <p>Phone: {restaurant.phone || "-"}</p>
          <p>Email: {restaurant.email || "-"}</p>
          <p>Address: {restaurant.address || "-"}</p>
          <p>Created: {new Date(restaurant.createdAt).toLocaleString()}</p>
        </div>
        <div className="p-4 bg-white rounded shadow">
          <h4 className="font-bold">Admin Information</h4>
          <p>Name: {admin?.fullName || "-"}</p>
          <p>Email: {admin?.email || "-"}</p>
          <p>Status: {admin?.isActive ? "Active" : "Inactive"}</p>
          <p>Last Login: {admin?.lastLogin ? new Date(admin.lastLogin).toLocaleString() : "-"}</p>
        </div>
        <div className="p-4 bg-white rounded shadow">
          <h4 className="font-bold">Subscription</h4>
          <p>Plan: {subscription?.planName || "-"}</p>
          <p>Status: {subscription?.status || "-"}</p>
          {subscription?.status === "trial" && (
            <>
              <p className="text-amber-700 font-medium">15-Day Free Trial</p>
              <p>Trial Start: {subscription?.trialStartAt ? new Date(subscription.trialStartAt).toLocaleString() : "-"}</p>
              <p>Trial End: {subscription?.trialEndAt ? new Date(subscription.trialEndAt).toLocaleString() : "-"}</p>
              <p>Days Remaining: {subscription?.daysRemaining <= 0 ? "EXPIRED" : subscription?.daysRemainingLabel || subscription?.daysRemaining}</p>
            </>
          )}
          {subscription?.status === "active" && (
            <>
              <p>Price: ₹{subscription?.price || "-"}</p>
              <p>Subscription Start: {subscription?.subscriptionStartAt ? new Date(subscription.subscriptionStartAt).toLocaleString() : "-"}</p>
              <p>Renewal: {subscription?.renewalDate ? new Date(subscription.renewalDate).toLocaleDateString() : "-"}</p>
            </>
          )}
          {subscription?.status === "expired" && <p className="text-rose-700 font-medium">Upgrade Subscription required</p>}
        </div>
      </div>
    </div>
  );
};

export default RestaurantDetailsPage;
