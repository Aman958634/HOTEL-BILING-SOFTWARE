import { FiCheckCircle, FiClock, FiXCircle, FiLoader, FiArchive } from "react-icons/fi";

const statusConfig = {
  PENDING: { label: "Pending", icon: <FiClock aria-hidden="true" />, className: "border-amber-200 bg-amber-50 text-amber-700" },
  CONFIRMED: { label: "Confirmed", icon: <FiCheckCircle aria-hidden="true" />, className: "border-sky-200 bg-sky-50 text-sky-700" },
  PREPARING: { label: "Preparing", icon: <FiLoader aria-hidden="true" />, className: "border-violet-200 bg-violet-50 text-violet-700" },
  READY: { label: "Ready", icon: <FiArchive aria-hidden="true" />, className: "border-indigo-200 bg-indigo-50 text-indigo-700" },
  OUT_FOR_DELIVERY: { label: "Out for delivery", icon: <FiLoader aria-hidden="true" />, className: "border-cyan-200 bg-cyan-50 text-cyan-700" },
  SERVED: { label: "Served", icon: <FiCheckCircle aria-hidden="true" />, className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  COMPLETED: { label: "Completed", icon: <FiCheckCircle aria-hidden="true" />, className: "border-green-200 bg-green-50 text-green-700" },
  CANCELLED: { label: "Cancelled", icon: <FiXCircle aria-hidden="true" />, className: "border-rose-200 bg-rose-50 text-rose-700" },
  REJECTED: { label: "Rejected", icon: <FiXCircle aria-hidden="true" />, className: "border-rose-200 bg-rose-50 text-rose-700" },
};

const normalize = (status) => String(status || "PENDING").toUpperCase();

const OrderStatusBadge = ({ status }) => {
  const cfg = statusConfig[normalize(status)] || statusConfig.PENDING;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium ${cfg.className}`}>
      {cfg.icon}
      <span>{cfg.label}</span>
    </span>
  );
};

export const orderStatusOptions = Object.keys(statusConfig);

export default OrderStatusBadge;
