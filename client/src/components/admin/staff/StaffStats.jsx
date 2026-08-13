import { FiCoffee, FiTruck, FiUser, FiUserCheck, FiUserMinus, FiUsers } from "react-icons/fi";
import StatCard from "../StatCard";

const StaffStats = ({ stats, loading }) => {
  const cards = [
    { key: "totalStaff", label: "Total Staff", icon: <FiUsers /> },
    { key: "activeStaff", label: "Active Staff", icon: <FiUserCheck /> },
    { key: "inactiveStaff", label: "Inactive Staff", icon: <FiUserMinus /> },
    { key: "chefs", label: "Chefs", icon: <FiCoffee /> },
    { key: "waiters", label: "Waiters", icon: <FiUser /> },
    { key: "deliveryStaff", label: "Delivery Staff", icon: <FiTruck /> },
  ];

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map((card) => (
        <StatCard key={card.key} icon={card.icon} label={card.label} value={stats?.[card.key] ?? 0} trend={0} />
      ))}
    </div>
  );
};

export default StaffStats;
