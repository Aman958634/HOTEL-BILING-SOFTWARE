const roleOptions = ["All", "ADMIN", "MANAGER", "CHEF", "WAITER", "DELIVERY", "CASHIER", "RECEPTIONIST", "INVENTORY_MANAGER"];
const statusOptions = ["All", "ACTIVE", "INACTIVE", "ON_LEAVE", "SUSPENDED"];
const departmentOptions = ["All", "Management", "Kitchen", "Service", "Delivery", "Billing", "Reception", "Inventory"];

const StaffToolbar = ({ filters, onChange, onCreate }) => {
  const update = (patch) => onChange({ ...filters, ...patch, page: 1 });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr_auto]">
        <input
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
          placeholder="Search staff..."
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
        />
        <select value={filters.role} onChange={(e) => update({ role: e.target.value })} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
          {roleOptions.map((role) => <option key={role} value={role === "All" ? "" : role}>{role === "All" ? "Role: All" : role}</option>)}
        </select>
        <select value={filters.status} onChange={(e) => update({ status: e.target.value })} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
          {statusOptions.map((status) => <option key={status} value={status === "All" ? "" : status}>{status === "All" ? "Status: All" : status}</option>)}
        </select>
        <select value={filters.department} onChange={(e) => update({ department: e.target.value })} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">
          {departmentOptions.map((department) => <option key={department} value={department === "All" ? "" : department}>{department === "All" ? "Department: All" : department}</option>)}
        </select>
        <button onClick={onCreate} className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-medium text-white">
          + Add Staff
        </button>
      </div>
    </div>
  );
};

export default StaffToolbar;
