import { memo } from "react";
import { FiCheckCircle, FiGrid, FiTool, FiUsers } from "react-icons/fi";
import { HiOutlineStatusOnline } from "react-icons/hi";

const cards = [
  { key: "totalTables", label: "Total Tables", icon: <FiGrid /> },
  { key: "available", label: "Available", icon: <FiCheckCircle /> },
  { key: "occupied", label: "Occupied", icon: <FiUsers /> },
  { key: "reserved", label: "Reserved", icon: <HiOutlineStatusOnline /> },
  { key: "maintenance", label: "Maintenance", icon: <FiTool /> },
];

const TableStats = ({ stats, loading }) => {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <div key={card.key} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <article key={card.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-sm">{card.label}</span>
            <span className="text-base">{card.icon}</span>
          </div>
          <p className="mt-2 text-2xl font-semibold text-slate-900">{stats?.[card.key] ?? 0}</p>
        </article>
      ))}
    </div>
  );
};

export default memo(TableStats);
