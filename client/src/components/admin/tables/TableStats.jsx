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
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {cards.map((card) => (
          <div key={card.key} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {cards.map((card) => (
        <article key={card.key} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex min-w-0 items-center justify-between gap-2 text-slate-500">
            <span className="truncate text-xs font-medium sm:text-sm">{card.label}</span>
            <span className="shrink-0 text-base" aria-hidden="true">{card.icon}</span>
          </div>
          <p className="mt-1 text-xl font-semibold text-slate-900 sm:mt-2 sm:text-2xl">{stats?.[card.key] ?? 0}</p>
        </article>
      ))}
    </div>
  );
};

export default memo(TableStats);
