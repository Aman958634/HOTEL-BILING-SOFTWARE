import { FiAlertCircle, FiCheckCircle, FiDollarSign, FiRotateCcw, FiTrendingUp } from "react-icons/fi";
import StatCard from "../admin/StatCard";
import { getPaymentAmount } from "../../utils/paymentUtils";

const formatMoney = (value) => {
  const num = Number(value);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number.isFinite(num) ? num : 0);
};

const PaymentStats = ({ stats, loading }) => {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    );
  }

  const summary = stats?.summary || stats || {};

  const totalRevenue = formatMoney(summary.totalRevenue);
  const todayRevenue = formatMoney(summary.todayRevenue);

  const cards = [
    { label: "Total Revenue", value: totalRevenue, icon: <FiDollarSign />, trend: 0 },
    { label: "Today's Revenue", value: todayRevenue, icon: <FiTrendingUp />, trend: 0 },
    { label: "Successful Payments", value: summary.successfulPayments ?? 0, icon: <FiCheckCircle />, trend: 0 },
    { label: "Pending Payments", value: summary.pendingPayments ?? 0, icon: <FiRotateCcw />, trend: 0 },
    { label: "Failed / Refunded", value: summary.failedRefunded ?? 0, icon: <FiAlertCircle />, trend: 0 },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <StatCard key={card.label} icon={card.icon} label={card.label} value={card.value} trend={card.trend} />
      ))}
    </div>
  );
};

export default PaymentStats;
