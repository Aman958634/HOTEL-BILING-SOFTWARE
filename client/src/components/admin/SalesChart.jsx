import { memo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FiBarChart2 } from "react-icons/fi";

const SalesChart = ({ data, range, onRangeChange, loading, error, onRetry }) => (
  <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4 md:p-5" aria-labelledby="sales-overview-title">
    <div className="mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2 sm:mb-4 sm:gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <FiBarChart2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
        <h3 id="sales-overview-title" className="truncate text-lg font-semibold text-slate-900">Sales Overview</h3>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2" aria-label="Sales range">
        {["today", "7d", "30d", "year"].map((item) => (
          <button key={item} type="button" onClick={() => onRangeChange(item)} className={`min-h-10 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-3 ${range === item ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
            {item === "7d" ? "7 Days" : item === "30d" ? "30 Days" : item === "year" ? "This Year" : "Today"}
          </button>
        ))}
      </div>
    </div>

    {loading ? (
      <div className="h-56 animate-pulse rounded-xl bg-slate-100 sm:h-64 md:h-80" aria-busy="true" />
    ) : error ? (
      <div className="flex h-56 flex-col items-center justify-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-center text-sm text-rose-700 sm:h-64 md:h-80" role="alert">
        <span>Unable to load sales overview.</span>
        <button type="button" onClick={onRetry} className="min-h-10 rounded-lg bg-rose-700 px-3 text-sm font-semibold text-white hover:bg-rose-800">Retry</button>
      </div>
    ) : data.length === 0 ? (
      <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 sm:h-64 md:h-80">
        <FiBarChart2 className="h-8 w-8 text-slate-300" aria-hidden="true" />
        <span>No sales data found for the selected range.</span>
      </div>
    ) : (
      <div className="h-56 sm:h-64 md:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs><linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#059669" stopOpacity={0.3} /><stop offset="95%" stopColor="#059669" stopOpacity={0.02} /></linearGradient></defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="_id" minTickGap={24} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis width={42} tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)" }} />
            <Area type="monotone" dataKey="revenue" stroke="#059669" strokeWidth={2} fillOpacity={1} fill="url(#salesGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )}
  </section>
);

export default memo(SalesChart);
