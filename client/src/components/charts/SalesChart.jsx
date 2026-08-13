import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";

const SalesChart = ({ data = [] }) => (
  <div className="glass rounded-2xl p-4 h-80">
    <h3 className="text-lg font-semibold mb-3">Daily Sales</h3>
    <ResponsiveContainer width="100%" height="90%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="_id" />
        <YAxis />
        <Tooltip />
        <Line type="monotone" dataKey="amount" stroke="#0f766e" strokeWidth={3} />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

export default SalesChart;
