import { useNavigate } from "react-router-dom";
import TableStatusBadge from "./TableStatusBadge";

const fmtDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
};

const TableDetails = ({ open, loading, table, onClose }) => {
  if (!open) return null;

  const navigate = useNavigate();
  const status = String(table?.status || "").toUpperCase();
  const hasActiveOrder = table?.currentOrder && status === "OCCUPIED";
  const activeOrderCount = Number(table?.activeOrderCount || 0);
  const activeOrders = table?.activeOrders || [];

  const handleCreateOrder = () => {
    navigate("/dashboard/admin/orders", { state: { tableId: table._id, fromTable: true } });
  };

  const handleViewOrder = () => {
    const orderId = table?.currentOrder?._id || table?.currentOrder;
    if (orderId) {
      navigate("/dashboard/admin/orders", { state: { orderId, fromTable: true } });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Table Details</h3>
            <p className="mt-1 text-sm text-slate-500">Detailed occupancy and reservation context for this table.</p>
          </div>
          <button onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-1 text-sm text-slate-700">
            Close
          </button>
        </div>

        {loading ? (
          <div className="mt-6 space-y-3">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="h-12 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : table ? (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Table Number</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{table.tableNumber}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Current Status</p>
              <div className="mt-2"><TableStatusBadge status={table.status} /></div>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Capacity</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{table.capacity} Guests</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Floor / Section</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{table.floor} / {table.section}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Shape</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{table.shape}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Current Customer</p>
              <p className="mt-1 text-sm text-slate-800">{table.currentCustomer?.fullName || "-"}</p>
              <p className="text-xs text-slate-500">{table.currentCustomer?.email || ""}</p>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 md:col-span-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Current Order</p>
              {table.currentOrder ? (
                <div className="mt-2 grid gap-2 text-sm text-slate-800 md:grid-cols-3">
                  <p><strong>Order:</strong> {table.currentOrder.orderNumber || "-"}</p>
                  <p><strong>Status:</strong> {table.currentOrder.status || "-"}</p>
                  <p><strong>Total:</strong> {typeof table.currentOrder.total === "number" ? `Rs ${table.currentOrder.total}` : "-"}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No active order.</p>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 p-4 md:col-span-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Active Orders ({activeOrderCount})</p>
              {activeOrderCount > 0 ? (
                <ul className="mt-2 space-y-1 text-sm text-slate-800">
                  {activeOrders.map((order) => (
                    <li key={order._id}>
                      <strong>{order.orderNumber || "-"}</strong> · {order.status || "-"}
                      {typeof order.total === "number" ? ` · Rs ${order.total}` : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No active orders.</p>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 p-4 md:col-span-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Current Reservation</p>
              {table.currentReservation ? (
                <div className="mt-2 grid gap-2 text-sm text-slate-800 md:grid-cols-2">
                  <p><strong>Customer:</strong> {table.currentReservation.customer?.fullName || "-"}</p>
                  <p><strong>Date & Time:</strong> {fmtDate(table.currentReservation.date)}</p>
                  <p><strong>Guests:</strong> {table.currentReservation.guests || "-"}</p>
                  <p><strong>Reservation Status:</strong> {table.currentReservation.status || "-"}</p>
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No active reservation.</p>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 p-4 md:col-span-2 flex flex-wrap gap-3">
              {status === "AVAILABLE" && (
                <button
                  type="button"
                  onClick={handleCreateOrder}
                  className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
                >
                  Create New Order
                </button>
              )}
              {hasActiveOrder && (
                <button
                  type="button"
                  onClick={handleViewOrder}
                  className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100"
                >
                  View Active Order
                </button>
              )}
              <button
                type="button"
                onClick={() => onClose?.()}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-6 text-sm text-rose-600">Unable to load table details.</p>
        )}
      </div>
    </div>
  );
};

export default TableDetails;
