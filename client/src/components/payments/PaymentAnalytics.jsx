import { Bar, BarChart, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency, formatPaymentDay, paymentMethodLabel, paymentStatusLabel } from "../../utils/paymentUtils";

const COLORS = ["#0f766e", "#0ea5e9", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6"];

const Panel = ({ title, children }) => (
  <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
    <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
    <div className="mt-3 h-52 sm:h-64">{children}</div>
  </div>
);

const PaymentAnalytics = ({ stats, loading }) => {
  if (loading) {
    return <div className="h-52 animate-pulse rounded-2xl bg-slate-100 sm:h-64" />;
  }

  const revenueByDay = (stats?.revenueByDay || []).map((item) => ({ ...item, label: formatPaymentDay(item.label) }));
  const revenueByMethod = (stats?.revenueByMethod || []).map((item) => ({ ...item, label: paymentMethodLabel(item.method) }));
  const statusData = (stats?.paymentStatusBreakdown || []).map((item) => ({ ...item, label: paymentStatusLabel(item.status) }));

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Payment Analytics</h3>
          <p className="text-sm text-slate-500">Revenue, payment method performance and refund trends.</p>
        </div>
        <div className="rounded-2xl bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
          Average Order Value: <span className="font-semibold text-slate-900">{formatCurrency(stats?.averageOrderValue || 0)}</span>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Revenue by Day">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={revenueByDay}>
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#0f766e" strokeWidth={3} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Revenue by Payment Method">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={revenueByMethod}>
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
              <Bar dataKey="revenue" fill="#0f766e" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title="Successful vs Failed Payments">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={statusData} dataKey="count" nameKey="label" outerRadius={95} innerRadius={55} paddingAngle={4}>
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Panel>
      </div>
    </div>
  );
};

export default PaymentAnalytics;
