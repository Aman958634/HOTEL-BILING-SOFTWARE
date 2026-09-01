import { FiAlertCircle, FiCheckCircle, FiClock, FiTool } from "react-icons/fi";

const config = {
  AVAILABLE: {
    label: "Available",
    icon: <FiCheckCircle className="text-emerald-600" aria-hidden="true" />,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  OCCUPIED: {
    label: "Occupied",
    icon: <FiAlertCircle className="text-rose-600" aria-hidden="true" />,
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
  RESERVED: {
    label: "Reserved",
    icon: <FiClock className="text-amber-600" aria-hidden="true" />,
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  MAINTENANCE: {
    label: "Maintenance",
    icon: <FiTool className="text-slate-600" aria-hidden="true" />,
    className: "border-slate-300 bg-slate-100 text-slate-700",
  },
};

const normalizeStatus = (status) => String(status || "AVAILABLE").toUpperCase();

const TableStatusBadge = ({ status }) => {
  const normalized = normalizeStatus(status);
  const item = config[normalized] || config.AVAILABLE;

  return (
    <span
      aria-label={`Table status: ${item.label}`}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${item.className}`}
    >
      {item.icon}
      <span className="truncate">{item.label}</span>
    </span>
  );
};

export const tableStatusOptions = Object.keys(config);

export default TableStatusBadge;
