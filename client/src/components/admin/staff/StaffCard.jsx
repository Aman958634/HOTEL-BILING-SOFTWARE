import { FiCalendar, FiEdit2, FiEye, FiMail, FiPhone, FiTrash2 } from "react-icons/fi";
import RoleBadge from "./RoleBadge";
import StaffStatusBadge from "./StaffStatusBadge";

const StaffCard = ({ staff, onView, onEdit, onStatus, onDelete, canDelete }) => {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-slate-100 text-lg font-bold text-slate-700">
            {staff.profilePhoto ? <img src={staff.profilePhoto} alt={staff.fullName} className="h-full w-full object-cover" /> : staff.fullName?.slice(0, 1) || "S"}
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">{staff.fullName}</h3>
            <p className="text-xs text-slate-500">{staff.employeeId}</p>
          </div>
        </div>
        <StaffStatusBadge status={staff.status} />
      </div>

      <div className="mt-3 space-y-1.5 text-sm text-slate-600">
        <p className="flex items-center gap-2"><FiPhone /> {staff.phone}</p>
        <p className="flex items-center gap-2"><FiMail /> {staff.email || "Not available"}</p>
        <p className="flex items-center gap-2"><FiCalendar /> Joined {staff.joiningDateLabel}</p>
        <div className="pt-1"><RoleBadge role={staff.role} /></div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => onView(staff)} className="min-h-11 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700"><span className="inline-flex items-center gap-1"><FiEye /> View</span></button>
        <button onClick={() => onEdit(staff)} className="min-h-11 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700"><span className="inline-flex items-center gap-1"><FiEdit2 /> Edit</span></button>
        <button onClick={() => onStatus(staff)} className="min-h-11 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700">{String(staff.status || "ACTIVE").toUpperCase() === "ACTIVE" ? "Deactivate" : "Reactivate"}</button>
        {canDelete && <button onClick={() => onDelete(staff)} className="min-h-11 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-sm text-rose-700"><span className="inline-flex items-center gap-1"><FiTrash2 /> Delete</span></button>}
      </div>
    </article>
  );
};

export default StaffCard;
