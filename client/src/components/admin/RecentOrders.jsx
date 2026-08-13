import { currency, dateTime } from "../../utils/format";

const statusOptions = [
  { label: "Pending", value: "PENDING" },
  { label: "Confirmed", value: "CONFIRMED" },
  { label: "Preparing", value: "PREPARING" },
  { label: "Ready", value: "READY" },
  { label: "Served", value: "SERVED" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Cancelled", value: "CANCELLED" },
];

const RecentOrders = ({ orders, loading, onStatusChange, onDelete }) => {
  if (loading) {
    return <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />;
  }

  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
        No recent orders found.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-lg font-semibold text-slate-900">Recent Orders</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
              <th className="py-2 pr-3">Order ID</th>
              <th className="py-2 pr-3">Customer</th>
              <th className="py-2 pr-3">Items</th>
              <th className="py-2 pr-3">Amount</th>
              <th className="py-2 pr-3">Payment</th>
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Date</th>
              <th className="py-2 pr-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order._id} className="border-b border-slate-100 text-slate-700">
                <td className="py-2 pr-3 font-medium">{order.orderNumber}</td>
                <td className="py-2 pr-3">{order.customer}</td>
                <td className="py-2 pr-3">{order.items}</td>
                <td className="py-2 pr-3">{currency(order.amount)}</td>
                <td className="py-2 pr-3 capitalize">{order.payment}</td>
                <td className="py-2 pr-3">{order.status}</td>
                <td className="py-2 pr-3">{dateTime(order.date)}</td>
                <td className="py-2 pr-3">
                  <select
                    className="rounded-lg border border-slate-300 p-1 text-xs"
                    value={order.rawStatus || order.status}
                    onChange={(e) => onStatusChange(order._id, e.target.value)}
                  >
                    {statusOptions.map((status) => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => onDelete(order)}
                    className="ml-2 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default RecentOrders;
