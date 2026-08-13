import { useEffect, useState } from "react";
import api from "../../services/api";
import Card from "../../components/ui/Card";
import SalesChart from "../../components/charts/SalesChart";

const AdminDashboard = () => {
  const [stats, setStats] = useState({ cards: {}, dailySales: [] });

  useEffect(() => {
    api.get("/analytics/dashboard").then((res) => setStats(res.data.data)).catch(() => setStats({ cards: {}, dailySales: [] }));
  }, []);

  return (
    <div>
      <h2 className="mb-4 text-2xl font-bold">Admin Dashboard</h2>
      <div className="grid gap-3 md:grid-cols-4">
        <Card title="Orders" value={stats.cards.orders || 0} />
        <Card title="Revenue" value={stats.cards.revenue || 0} />
        <Card title="Foods" value={stats.cards.foods || 0} />
        <Card title="Inventory" value={stats.cards.inventory || 0} />
      </div>
      <div className="mt-4">
        <SalesChart data={stats.dailySales} />
      </div>
    </div>
  );
};

export default AdminDashboard;
