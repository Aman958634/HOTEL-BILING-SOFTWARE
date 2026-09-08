import { FiDollarSign, FiPackage, FiXCircle, FiClock, FiTool, FiCheckCircle } from "react-icons/fi";
import { currency } from "../../../utils/format";
import ModuleIcon from "../../common/ModuleIcon";

const cards = [
  { key: "totalOrders", label: "Total Orders", icon: <FiPackage />, module: "orders" },
  { key: "pending", label: "Pending", icon: <FiClock />, module: "orders" },
  { key: "preparing", label: "Preparing", icon: <FiTool />, module: "kitchen" },
  { key: "ready", label: "Ready", icon: <FiCheckCircle />, module: "menu" },
  { key: "completed", label: "Completed", icon: <FiCheckCircle />, module: "dashboard" },
  { key: "cancelled", label: "Cancelled", icon: <FiXCircle />, module: "notifications" },
  { key: "todayRevenue", label: "Today's Revenue", icon: <FiDollarSign />, module: "todayRevenue", money: true },
];

const OrderStats = ({ stats, loading }) => {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
        {cards.map((card) => (
          <div key={card.key} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
      {cards.map((card) => (
        <div key={card.key} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex min-w-0 items-center justify-between gap-2 text-slate-500">
            <p className="truncate text-xs uppercase tracking-wide">{card.label}</p>
            <ModuleIcon icon={card.icon} module={card.module} variant="section" />
          </div>
          <p className="mt-1 break-words text-xl font-bold text-slate-900 sm:mt-2">
            {card.money ? currency(stats?.[card.key] || 0) : stats?.[card.key] || 0}
          </p>
        </div>
      ))}
    </div>
  );
};

export default OrderStats;
