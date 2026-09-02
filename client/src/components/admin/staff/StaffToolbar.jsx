const roleOptions = ["All", "ADMIN", "MANAGER", "CHEF", "WAITER", "DELIVERY", "CASHIER", "RECEPTIONIST", "INVENTORY_MANAGER"];
const statusOptions = ["All", "ACTIVE", "INACTIVE", "ON_LEAVE", "SUSPENDED"];
const departmentOptions = ["All", "Management", "Kitchen", "Service", "Delivery", "Billing", "Reception", "Inventory"];

const StaffToolbar = ({ filters, onChange, onCreate }) => {
  const update = (patch) => onChange({ ...filters, ...patch, page: 1 });

  return (
    <div className="ops-filter-bar">
      <div className="grid gap-3 lg:grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr_auto]">
        <input
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
          placeholder="Search name, phone, email or role"
          aria-label="Search staff"
          className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm"
        />
        <select aria-label="Filter by role" value={filters.role} onChange={(e) => update({ role: e.target.value })} className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm">
          {roleOptions.map((role) => <option key={role} value={role === "All" ? "" : role}>{role === "All" ? "Role: All" : role}</option>)}
        </select>
        <select aria-label="Filter by status" value={filters.status} onChange={(e) => update({ status: e.target.value })} className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm">
          {statusOptions.map((status) => <option key={status} value={status === "All" ? "" : status}>{status === "All" ? "Status: All" : status}</option>)}
        </select>
        <select aria-label="Filter by department" value={filters.department} onChange={(e) => update({ department: e.target.value })} className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm">
          {departmentOptions.map((department) => <option key={department} value={department === "All" ? "" : department}>{department === "All" ? "Department: All" : department}</option>)}
        </select>
        <button onClick={onCreate} className="min-h-11 rounded-xl bg-brand-700 px-4 text-sm font-medium text-white">
          + Add Staff
        </button>
      </div>
    </div>
  );
};

export default StaffToolbar;
