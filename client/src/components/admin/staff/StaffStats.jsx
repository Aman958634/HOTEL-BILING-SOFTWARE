import { FiCoffee, FiTruck, FiUser, FiUserCheck, FiUserMinus, FiUsers } from "react-icons/fi";
import StatCard from "../StatCard";

const StaffStats = ({ stats, loading }) => {
  const cards = [
    { key: "totalStaff", label: "Total Staff", icon: <FiUsers />, module: "staff" },
    { key: "activeStaff", label: "Active Staff", icon: <FiUserCheck />, module: "staff" },
    { key: "inactiveStaff", label: "Inactive Staff", icon: <FiUserMinus />, module: "notifications" },
    { key: "chefs", label: "Chefs", icon: <FiCoffee />, module: "kitchen" },
    { key: "waiters", label: "Waiters", icon: <FiUser />, module: "staff" },
    { key: "deliveryStaff", label: "Delivery Staff", icon: <FiTruck />, module: "onlineOrders" },
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
        <StatCard key={card.key} icon={card.icon} iconModule={card.module} label={card.label} value={stats?.[card.key] ?? 0} showComparison={false} />
      ))}
    </div>
  );
};

export default StaffStats;
