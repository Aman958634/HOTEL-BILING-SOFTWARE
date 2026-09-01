import { useEffect, useState } from "react";
import EmptyState from "../../components/common/EmptyState";
import { SkeletonTable } from "../../components/common/Skeletons";
import { Link, useNavigate } from "react-router-dom";
import { fetchUsers, deleteUser, updateUserStatus } from "../../services/superAdminService";
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

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ q: "", role: "", status: "" });
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const navigate = useNavigate();

  const loadUsers = async (page = 1) => {
    setLoading(true);
    try {
      const params = {
        q: filters.q || undefined,
        role: filters.role || undefined,
        status: filters.status || undefined,
        page,
        limit: meta.limit,
      };
      const { data } = await fetchUsers(params);
      const responseData = data.data || {};
      setUsers(responseData.items || []);
      setMeta(responseData.meta || { page: 1, limit: 20, total: 0, totalPages: 1 });
    } catch (err) {
      toast.error(err?.response?.data?.message || "Unable to load users");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers(1);
  }, []);

  const applyFilters = () => {
    loadUsers(1);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this user?")) return;
    try {
      await deleteUser(id);
      toast.success("User deleted");
      loadUsers(meta.page);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Unable to delete user");
    }
  };

  const handleToggleStatus = async (id, isActive) => {
    try {
      await updateUserStatus(id, isActive ? "inactive" : "active");
      toast.success(`User ${isActive ? "deactivated" : "activated"}`);
      loadUsers(meta.page);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Unable to update status");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Users</h2>
          <p className="mt-1 text-sm text-slate-500">Manage platform users, roles, and access for the SaaS system.</p>
        </div>
        <button onClick={() => navigate("new")} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700">
          + Add User
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-3 mb-4">
        <input
          value={filters.q}
          onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
          placeholder="Search name, email or phone"
          className="border rounded p-2"
        />
        <select
          value={filters.role}
          onChange={(e) => setFilters((prev) => ({ ...prev, role: e.target.value }))}
          className="border rounded p-2"
        >
          <option value="">All roles</option>
          {USER_ROLES.map((role) => (
            <option key={role} value={role}>{role.replaceAll("_", " ")}</option>
          ))}
        </select>
        <select
          value={filters.status}
          onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
          className="border rounded p-2"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      <div className="mb-4">
        <button onClick={applyFilters} className="btn rounded bg-slate-900 text-white px-4 py-2">
          Apply filters
        </button>
      </div>

      <div className="bg-white rounded shadow p-4 overflow-x-auto">
        {loading ? (
          <SkeletonTable rows={6} columns={7} />
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="p-2 border">Name</th>
                <th className="p-2 border">Email</th>
                <th className="p-2 border">Phone</th>
                <th className="p-2 border">Role</th>
                <th className="p-2 border">Status</th>
                <th className="p-2 border">Created</th>
                <th className="p-2 border">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-slate-500">
                    <EmptyState title="No users yet" description="User accounts will appear here as your platform grows." />
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user._id} className="border-t">
                    <td className="p-2 border">{user.fullName}</td>
                    <td className="p-2 border">{user.email}</td>
                    <td className="p-2 border">{user.phone || "-"}</td>
                    <td className="p-2 border">{user.role}</td>
                    <td className="p-2 border">{user.isActive ? "Active" : "Inactive"}</td>
                    <td className="p-2 border">{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td className="p-2 border space-x-2">
                      <Link to={`${user._id}`} className="text-teal-600 hover:underline">View</Link>
                      <button onClick={() => handleToggleStatus(user._id, user.isActive)} className="text-slate-600 hover:underline">
                        {user.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button onClick={() => handleDelete(user._id)} className="text-red-600 hover:underline">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {(meta.totalPages || 1) > 1 && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
        <div>
          Showing {users.length} of {meta.total} users
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadUsers(Math.max(1, meta.page - 1))}
            disabled={meta.page <= 1}
            className="rounded border border-slate-300 px-3 py-1 disabled:opacity-50"
          >
            Previous
          </button>
          <span>
            Page {meta.page} of {meta.totalPages}
          </span>
          <button
            onClick={() => loadUsers(Math.min(meta.totalPages, meta.page + 1))}
            disabled={meta.page >= meta.totalPages}
            className="rounded border border-slate-300 px-3 py-1 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>}
    </div>
  );
};

export default UsersPage;
