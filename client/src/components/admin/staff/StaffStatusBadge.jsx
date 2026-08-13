import { FiCheckCircle, FiClock, FiSlash, FiXCircle } from "react-icons/fi";

const config = {
  ACTIVE: { label: "Active", icon: <FiCheckCircle aria-hidden="true" />, className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  INACTIVE: { label: "Inactive", icon: <FiXCircle aria-hidden="true" />, className: "border-slate-300 bg-slate-100 text-slate-700" },
  ON_LEAVE: { label: "On Leave", icon: <FiClock aria-hidden="true" />, className: "border-amber-200 bg-amber-50 text-amber-700" },
  SUSPENDED: { label: "Suspended", icon: <FiSlash aria-hidden="true" />, className: "border-rose-200 bg-rose-50 text-rose-700" },
};

const StaffStatusBadge = ({ status }) => {
  const normalized = String(status || "ACTIVE").toUpperCase();
  const item = config[normalized] || config.INACTIVE;

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${item.className}`} aria-label={`Staff status: ${item.label}`}>
      {item.icon}
      <span>{item.label}</span>
    </span>
  );
};

export default StaffStatusBadge;
