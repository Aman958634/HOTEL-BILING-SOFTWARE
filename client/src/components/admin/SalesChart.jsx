import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FiAlertCircle, FiBarChart2, FiRefreshCw } from "react-icons/fi";

const SalesChart = ({ data, range, onRangeChange, loading, error, onRetry }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <FiBarChart2 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
        <h3 className="text-lg font-semibold text-slate-900">Sales Overview</h3>
      </div>
      <div className="flex items-center gap-2">
        {["today", "7d", "30d", "year"].map((item) => (
          <button
            key={item}
            onClick={() => onRangeChange(item)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              range === item
                ? "bg-emerald-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {item === "7d" ? "7 Days" : item === "30d" ? "30 Days" : item === "year" ? "This Year" : "Today"}
          </button>
        ))}
      </div>
    </div>

    {loading ? (
      <div className="h-64 md:h-80 animate-pulse rounded-xl bg-slate-100" />
    ) : error ? (
      <div className="flex h-64 md:h-80 flex-col items-center justify-center gap-3 rounded-xl border border-rose-200 bg-rose-50/40 p-4 text-center text-sm text-slate-600">
        <FiAlertCircle className="h-8 w-8 text-rose-500" aria-hidden="true" />
        <div><p className="font-medium text-slate-900">Sales overview is unavailable</p><p className="mt-1 text-slate-500">{error}</p></div>
        <button type="button" onClick={onRetry} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"><FiRefreshCw />Retry</button>
      </div>
    ) : data.length === 0 ? (
      <div className="flex h-64 md:h-80 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
        <FiBarChart2 className="h-8 w-8 text-slate-300" aria-hidden="true" />
        <span>No sales data found for selected range.</span>
      </div>
    ) : (
      <div className="h-64 md:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#059669" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#059669" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="_id" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: "12px",
                boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
              }}
            />
            <Area type="monotone" dataKey="revenue" stroke="#059669" strokeWidth={2} fillOpacity={1} fill="url(#salesGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )}
  </div>
);

export default SalesChart;
