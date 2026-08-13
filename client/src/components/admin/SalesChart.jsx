import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const SalesChart = ({ data, range, onRangeChange, loading }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h3 className="text-lg font-semibold text-slate-900">Sales Overview</h3>
      <div className="flex items-center gap-2">
        {["today", "7d", "30d", "year"].map((item) => (
          <button
            key={item}
            onClick={() => onRangeChange(item)}
            className={`rounded-lg px-3 py-1 text-xs font-medium ${
              range === item ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-700"
            }`}
          >
            {item === "7d" ? "7 Days" : item === "30d" ? "30 Days" : item === "year" ? "This Year" : "Today"}
          </button>
        ))}
      </div>
    </div>

    {loading ? (
      <div className="h-72 animate-pulse rounded-xl bg-slate-100" />
    ) : data.length === 0 ? (
      <div className="h-72 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
        No sales data found for selected range.
      </div>
    ) : (
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0f766e" stopOpacity={0.45} />
                <stop offset="95%" stopColor="#0f766e" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="_id" />
            <YAxis />
            <Tooltip />
            <Area type="monotone" dataKey="revenue" stroke="#0f766e" fillOpacity={1} fill="url(#salesGradient)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )}
  </div>
);

export default SalesChart;
