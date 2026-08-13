import { FiActivity, FiClock, FiMail, FiPhone, FiUser } from "react-icons/fi";
import RoleBadge from "./RoleBadge";
import StaffStatusBadge from "./StaffStatusBadge";

const formatDate = (value) => {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleString();
};

const StaffDetailsDrawer = ({ open, staff, loading, onClose }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50">
      <div className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Staff Profile</h3>
            <p className="text-sm text-slate-500">Detailed staff record and activity</p>
          </div>
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">Close</button>
        </div>

        {loading ? (
          <div className="mt-6 space-y-3">
            <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-44 animate-pulse rounded-2xl bg-slate-100" />
          </div>
        ) : staff ? (
          <div className="mt-6 space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start gap-4">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-slate-200 text-2xl font-bold text-slate-700">
                  {staff.profilePhoto ? <img src={staff.profilePhoto} alt={staff.fullName} className="h-full w-full object-cover" /> : (staff.fullName || "S").slice(0, 1)}
                </div>
                <div className="flex-1">
                  <h4 className="text-2xl font-bold text-slate-900">{staff.fullName || "Not available"}</h4>
                  <p className="text-sm text-slate-500">{staff.employeeId || "Not available"}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <RoleBadge role={staff.role} />
                    <StaffStatusBadge status={staff.status} />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                [<FiUser />, "Role", staff.role || "Not available"],
                [<FiUser />, "Department", staff.department || "Not available"],
                [<FiPhone />, "Phone", staff.phone || "Not available"],
                [<FiMail />, "Email", staff.email || "Not available"],
                [<FiClock />, "Joining Date", formatDate(staff.joiningDate)],
                [<FiActivity />, "Current Shift", staff.currentShift || "Not available"],
              ].map(([icon, label, value]) => (
                <div key={label} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">{icon}<span>{label}</span></div>
                  <p className="mt-2 text-sm font-medium text-slate-900">{value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Salary</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{staff.salary ? `₹${staff.salary}` : "Not available"}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Emergency Contact</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{staff.emergencyContact?.name || "Not available"}</p>
                <p className="text-sm text-slate-600">{staff.emergencyContact?.phone || ""} {staff.emergencyContact?.relationship ? `(${staff.emergencyContact.relationship})` : ""}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Attendance</p>
              <p className="mt-2 text-sm text-slate-700">{staff.attendance || "Attendance module not configured."}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Recent Activity</p>
              {staff.recentActivity?.length ? (
                <div className="mt-3 space-y-3">
                  {staff.recentActivity.map((activity, index) => (
                    <div key={`${activity.message}-${index}`} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm">
                      <p className="font-medium text-slate-900">{activity.message}</p>
                      <p className="text-xs text-slate-500">{formatDate(activity.createdAt)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">Not available</p>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Total Orders Handled</p><p className="mt-2 text-2xl font-bold text-slate-900">{staff.totalOrdersHandled ?? 0}</p></div>
              <div className="rounded-2xl border border-slate-200 p-4"><p className="text-xs uppercase tracking-wide text-slate-500">Last Login</p><p className="mt-2 text-sm font-medium text-slate-900">{formatDate(staff.lastLogin)}</p></div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-600">
              <p><strong>Created:</strong> {formatDate(staff.createdAt)}</p>
              <p><strong>Updated:</strong> {formatDate(staff.updatedAt)}</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default StaffDetailsDrawer;
