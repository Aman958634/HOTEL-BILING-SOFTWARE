import { useEffect, useState } from "react";

const roleOptions = ["ADMIN", "MANAGER", "CHEF", "WAITER", "DELIVERY", "CASHIER", "RECEPTIONIST", "INVENTORY_MANAGER"];
const departmentOptions = ["Management", "Kitchen", "Service", "Delivery", "Billing", "Reception", "Inventory"];
const statusOptions = ["ACTIVE", "INACTIVE", "ON_LEAVE", "SUSPENDED"];
const shiftOptions = ["Morning", "Evening", "Night"];

const initialForm = {
  firstName: "",
  lastName: "",
  profilePhoto: "",
  phone: "",
  email: "",
  password: "",
  createLoginAccount: false,
  role: "WAITER",
  department: "Service",
  employeeId: "",
  shift: "",
  joiningDate: "",
  salary: "",
  address: "",
  emergencyName: "",
  emergencyPhone: "",
  emergencyRelationship: "",
  status: "ACTIVE",
};

const StaffForm = ({ open, loading, initialData, onClose, onSubmit }) => {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;

    if (initialData) {
      setForm({
        firstName: initialData.firstName || "",
        lastName: initialData.lastName || "",
        profilePhoto: initialData.profilePhoto || "",
        phone: initialData.phone || "",
        email: initialData.email || "",
        password: "",
        createLoginAccount: Boolean(initialData.user),
        role: String(initialData.role || "WAITER").toUpperCase(),
        department: initialData.department || "Service",
        employeeId: initialData.employeeId || "",
        shift: initialData.shift?.name || initialData.currentShift || "",
        joiningDate: initialData.joiningDate ? String(initialData.joiningDate).slice(0, 10) : "",
        salary: initialData.salary ?? "",
        address: initialData.address || "",
        emergencyName: initialData.emergencyContact?.name || "",
        emergencyPhone: initialData.emergencyContact?.phone || "",
        emergencyRelationship: initialData.emergencyContact?.relationship || "",
        status: String(initialData.status || "ACTIVE").toUpperCase(),
      });
    } else {
      setForm(initialForm);
    }

    setErrors({});
  }, [open, initialData]);

  if (!open) return null;

  const validate = () => {
    const next = {};
    if (!form.firstName.trim()) next.firstName = "First name is required";
    if (!form.lastName.trim()) next.lastName = "Last name is required";
    if (!form.phone.trim()) next.phone = "Phone is required";
    if (!form.role) next.role = "Role is required";
    if (!form.department) next.department = "Department is required";
    if (!form.joiningDate) next.joiningDate = "Joining date is required";
    if (!form.status) next.status = "Status is required";
    if (form.createLoginAccount && !form.password.trim()) next.password = "Password is required for login-enabled staff";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Email must be valid";
    if (form.salary && Number(form.salary) < 0) next.salary = "Salary cannot be negative";

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    onSubmit({
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      profilePhoto: form.profilePhoto.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      password: form.createLoginAccount ? form.password : undefined,
      role: form.role,
      department: form.department,
      employeeId: form.employeeId.trim(),
      shift: form.shift || undefined,
      joiningDate: form.joiningDate,
      salary: form.salary === "" ? 0 : Number(form.salary),
      address: form.address.trim(),
      emergencyContact: {
        name: form.emergencyName.trim(),
        phone: form.emergencyPhone.trim(),
        relationship: form.emergencyRelationship.trim(),
      },
      status: form.status,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <form onSubmit={submit} className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-xl font-bold text-slate-900">{initialData ? "Edit Staff" : "Add Staff"}</h3>
        <p className="mt-1 text-sm text-slate-500">Manage staff identity, access, shift, and contact information.</p>

        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            ["firstName", "First Name"],
            ["lastName", "Last Name"],
            ["profilePhoto", "Profile Photo URL"],
            ["phone", "Phone"],
            ["email", "Email"],
            ["employeeId", "Employee ID"],
            ["salary", "Salary"],
            ["address", "Address"],
            ["emergencyName", "Emergency Contact Name"],
            ["emergencyPhone", "Emergency Contact Phone"],
            ["emergencyRelationship", "Emergency Relationship"],
          ].map(([key, label]) => (
            <div key={key} className={key === "address" ? "md:col-span-2 xl:col-span-3" : ""}>
              <label className="text-sm text-slate-600">{label}</label>
              <input
                value={form[key]}
                readOnly={key === "employeeId" && !initialData}
                placeholder={key === "employeeId" && !initialData ? "Generated automatically" : ""}
                type={key === "salary" ? "number" : "text"}
                className={`mt-1 w-full rounded-xl border border-slate-300 p-2 ${key === "employeeId" && !initialData ? "bg-slate-100" : ""}`}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
              {errors[key] && <p className="mt-1 text-xs text-rose-600">{errors[key]}</p>}
            </div>
          ))}

          <div>
            <label className="text-sm text-slate-600">Role</label>
            <select className="mt-1 w-full rounded-xl border border-slate-300 p-2" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
            {errors.role && <p className="mt-1 text-xs text-rose-600">{errors.role}</p>}
          </div>

          <div>
            <label className="text-sm text-slate-600">Department</label>
            <select className="mt-1 w-full rounded-xl border border-slate-300 p-2" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}>
              {departmentOptions.map((department) => <option key={department} value={department}>{department}</option>)}
            </select>
            {errors.department && <p className="mt-1 text-xs text-rose-600">{errors.department}</p>}
          </div>

          <div>
            <label className="text-sm text-slate-600">Shift</label>
            <select className="mt-1 w-full rounded-xl border border-slate-300 p-2" value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })}>
              <option value="">Not available</option>
              {shiftOptions.map((shift) => <option key={shift} value={shift}>{shift}</option>)}
            </select>
          </div>

          <div>
            <label className="text-sm text-slate-600">Joining Date</label>
            <input type="date" className="mt-1 w-full rounded-xl border border-slate-300 p-2" value={form.joiningDate} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} />
            {errors.joiningDate && <p className="mt-1 text-xs text-rose-600">{errors.joiningDate}</p>}
          </div>

          <div>
            <label className="text-sm text-slate-600">Status</label>
            <select className="mt-1 w-full rounded-xl border border-slate-300 p-2" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            {errors.status && <p className="mt-1 text-xs text-rose-600">{errors.status}</p>}
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input type="checkbox" checked={form.createLoginAccount} onChange={(e) => setForm({ ...form, createLoginAccount: e.target.checked })} />
            Create login-enabled account
          </label>

          {form.createLoginAccount && (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-sm text-slate-600">Password</label>
                <input type="password" className="mt-1 w-full rounded-xl border border-slate-300 p-2" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                {errors.password && <p className="mt-1 text-xs text-rose-600">{errors.password}</p>}
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700">Cancel</button>
          <button type="submit" disabled={loading} className="rounded-xl bg-brand-700 px-4 py-2 text-sm text-white disabled:opacity-70">{loading ? "Saving..." : initialData ? "Update Staff" : "Create Staff"}</button>
        </div>
      </form>
    </div>
  );
};

export default StaffForm;
