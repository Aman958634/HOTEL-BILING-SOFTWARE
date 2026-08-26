import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchRestaurants, updateRestaurantStatus } from "../../services/superAdminService";
import toast from "react-hot-toast";
import EmptyState from "../../components/common/EmptyState";
import { SkeletonTable } from "../../components/common/Skeletons";

const RestaurantsPage = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await fetchRestaurants({ q: query });
      setRestaurants(data.data.items || []);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load restaurants");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSuspend = async (id) => {
    if (!confirm("Are you sure you want to suspend this restaurant?")) return;
    try {
      await updateRestaurantStatus(id, { status: "suspended" });
      toast.success("Restaurant suspended");
      load();
    } catch (err) { toast.error("Failed to update status"); }
  };

  const handleActivate = async (id) => {
    try { await updateRestaurantStatus(id, { status: "active" }); toast.success("Restaurant activated"); load(); } catch (err) { toast.error("Failed to update status"); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold">Restaurants</h2>
          <p className="text-sm text-slate-500">Manage all restaurants connected to RestoSphere SaaS.</p>
        </div>
        <div>
          <button onClick={() => navigate("new")} className="btn bg-teal-700 text-white px-4 py-2 rounded">+ Add Restaurant</button>
        </div>
      </div>

      <div className="mb-4">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search restaurants..." className="border rounded p-2 w-80" />
        <button onClick={load} className="ml-2 btn">Search</button>
      </div>

      <div className="bg-white rounded shadow p-4">
        {loading ? <SkeletonTable rows={6} columns={8} /> : (
          <table className="w-full text-left">
            <thead>
              <tr>
                <th>Name</th>
                <th>Admin</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {restaurants.length === 0 && <tr><td colSpan={8} className="p-8"><EmptyState title="No restaurants yet" description="Add a restaurant to start managing its subscription and operations." action={<button onClick={() => navigate("new")} className="rounded bg-teal-700 px-4 py-2 text-sm text-white">+ Add Restaurant</button>} /></td></tr>}
              {restaurants.map((r) => (
                <tr key={r._id} className="border-t">
                  <td>{r.name}</td>
                  <td>{r.admin?.fullName || "-"}</td>
                  <td>{r.email || r.admin?.email}</td>
                  <td>{r.phone}</td>
                  <td>{r.subscription?.planName || "-"}</td>
                  <td>{r.isActive ? "Active" : "Suspended"}</td>
                  <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                  <td>
                    <Link to={`${r._id}`} className="text-teal-600 mr-2">View</Link>
                    <Link to={`${r._id}/edit`} className="text-slate-600 mr-2">Edit</Link>
                    {r.isActive ? <button onClick={() => handleSuspend(r._id)} className="text-red-600">Suspend</button> : <button onClick={() => handleActivate(r._id)} className="text-green-600">Activate</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default RestaurantsPage;
