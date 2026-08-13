import { FiShield } from "react-icons/fi";

const roleLabels = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  CHEF: "Chef",
  WAITER: "Waiter",
  DELIVERY: "Delivery",
  CASHIER: "Cashier",
  RECEPTIONIST: "Receptionist",
  INVENTORY_MANAGER: "Inventory Manager",
};

const RoleBadge = ({ role }) => {
  const label = roleLabels[String(role || "").toUpperCase()] || String(role || "Not available");
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
      <FiShield aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
};

export default RoleBadge;
