import { FiDollarSign, FiPackage, FiXCircle, FiClock, FiTool, FiCheckCircle } from "react-icons/fi";
import { currency } from "../../../utils/format";

const cards = [
  { key: "totalOrders", label: "Total Orders", icon: <FiPackage /> },
  { key: "pending", label: "Pending", icon: <FiClock /> },
  { key: "preparing", label: "Preparing", icon: <FiTool /> },
  { key: "ready", label: "Ready", icon: <FiCheckCircle /> },
  { key: "completed", label: "Completed", icon: <FiCheckCircle /> },
  { key: "cancelled", label: "Cancelled", icon: <FiXCircle /> },
  { key: "todayRevenue", label: "Today's Revenue", icon: <FiDollarSign />, money: true },
];

const OrderStats = ({ stats, loading }) => {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
        {cards.map((card) => (
          <div key={card.key} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
      {cards.map((card) => (
        <div key={card.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <p className="text-xs uppercase tracking-wide">{card.label}</p>
            <span className="text-sm">{card.icon}</span>
          </div>
          <p className="mt-2 text-xl font-bold text-slate-900">
            {card.money ? currency(stats?.[card.key] || 0) : stats?.[card.key] || 0}
          </p>
        </div>
      ))}
    </div>
  );
};

export default OrderStats;
