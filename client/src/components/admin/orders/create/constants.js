import { FiPackage, FiTruck, FiUsers } from "react-icons/fi";

export const ORDER_TYPES = [
  { value: "DINE_IN", label: "Dine In", icon: FiUsers },
  { value: "TAKEAWAY", label: "Take Away", icon: FiPackage },
  { value: "DELIVERY", label: "Delivery", icon: FiTruck },
];

export const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "CREDIT_CARD", label: "Card" },
  { value: "UPI", label: "UPI" },
  { value: "RAZORPAY", label: "Razorpay" },
  { value: "OTHER", label: "Other" },
];

export const PAYMENT_STATUSES = [
  { value: "PENDING", label: "Pending" },
  { value: "PAID", label: "Paid" },
  { value: "FAILED", label: "Failed" },
];

export const TABLE_STATUS_STYLES = {
  AVAILABLE: { label: "Available", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  OCCUPIED: { label: "Occupied", className: "bg-rose-50 text-rose-700 border-rose-200" },
  RESERVED: { label: "Reserved", className: "bg-amber-50 text-amber-700 border-amber-200" },
  MAINTENANCE: { label: "Unavailable", className: "bg-slate-100 text-slate-600 border-slate-200" },
};

export const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-100";

export const labelClass = "mb-1.5 block text-xs font-medium text-slate-600";

export const cardClass = "rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-4";

export const NOTE_MAX = 200;
export const INSTRUCTIONS_MAX = 250;
