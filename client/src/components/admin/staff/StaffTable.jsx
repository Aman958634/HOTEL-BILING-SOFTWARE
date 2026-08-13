import { FiEdit2, FiEye, FiTrash2 } from "react-icons/fi";
import RoleBadge from "./RoleBadge";
import StaffStatusBadge from "./StaffStatusBadge";

const StaffTable = ({ staff, loading, onView, onEdit, onStatus, onDelete, canDelete }) => {
  if (loading) {
    return <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />;
  }

  if (!staff.length) {
    return null;
  }

  return (
    <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
              <th className="px-4 py-3">Employee</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Department</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Shift</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Joined Date</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((item) => (
              <tr key={item._id} className="border-b border-slate-100 text-slate-700">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-sm font-bold text-slate-700">
                      {item.profilePhoto ? <img src={item.profilePhoto} alt={item.fullName} className="h-full w-full object-cover" /> : item.fullName?.slice(0, 1) || "S"}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{item.fullName}</p>
                      <p className="text-xs text-slate-500">{item.employeeId}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3"><RoleBadge role={item.role} /></td>
                <td className="px-4 py-3">{item.department}</td>
                <td className="px-4 py-3">{item.phone}</td>
                <td className="px-4 py-3">{item.email || "Not available"}</td>
                <td className="px-4 py-3">{item.shift?.name || item.currentShift || "Not available"}</td>
                <td className="px-4 py-3"><StaffStatusBadge status={item.status} /></td>
                <td className="px-4 py-3">{item.joiningDateLabel}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => onView(item)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700"><span className="inline-flex items-center gap-1"><FiEye /> View</span></button>
                    <button onClick={() => onEdit(item)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700"><span className="inline-flex items-center gap-1"><FiEdit2 /> Edit</span></button>
                    <button onClick={() => onStatus(item)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700">{String(item.status || "ACTIVE").toUpperCase() === "ACTIVE" ? "Deactivate" : "Reactivate"}</button>
                    {canDelete && <button onClick={() => onDelete(item)} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-700"><span className="inline-flex items-center gap-1"><FiTrash2 /> Delete</span></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StaffTable;
