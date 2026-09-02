import { memo, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TableStatusBadge from "./TableStatusBadge";
import { getTableQr } from "../../../services/tableService";
import { currency } from "../../../utils/format";

const fmtDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
};

const TableDetails = ({ open, loading, table, onClose }) => {
  const navigate = useNavigate();
  const [qrOpen, setQrOpen] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState("");
  const [qrCode, setQrCode] = useState("");
  const status = String(table?.status || "").toUpperCase();
  const hasActiveOrder = table?.currentOrder && status === "OCCUPIED";
  const activeOrderCount = Number(table?.activeOrderCount || 0);
  const activeOrders = table?.activeOrders || [];
  const visibleActiveOrders = activeOrders.length
    ? activeOrders
    : (typeof table?.currentOrder === "object" && table.currentOrder ? [table.currentOrder] : []);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== "Escape") return;
      if (qrOpen) setQrOpen(false);
      else onClose?.();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, qrOpen]);

  if (!open) return null;

  const handleCreateOrder = () => {
    navigate("/dashboard/admin/orders", { state: { tableId: table._id, fromTable: true } });
  };

  const handleViewOrder = (order = table?.currentOrder) => {
    const orderId = order?._id || order;
    if (orderId) {
      navigate("/dashboard/admin/orders", { state: { orderId, fromTable: true } });
    }
  };

  const openQr = async () => {
    setQrOpen(true);
    setQrLoading(true);
    setQrError("");
    setQrCode("");
    try {
      const { data } = await getTableQr(table._id);
      if (!data?.qrCode || !String(data.qrCode).startsWith("data:image/")) {
        throw new Error("Invalid QR response");
      }
      setQrCode(data.qrCode);
    } catch {
      setQrError("Unable to load QR code");
    } finally {
      setQrLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="table-details-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <div className="max-h-[90dvh] w-full max-w-[calc(100vw-1.5rem)] overflow-y-auto overscroll-contain rounded-2xl bg-white p-4 shadow-2xl sm:max-w-3xl sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 id="table-details-title" className="text-xl font-bold text-slate-900">Table Details</h3>
            <p className="mt-1 text-sm text-slate-500">Detailed occupancy and reservation context for this table.</p>
          </div>
          <button type="button" onClick={onClose} className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Close
          </button>
        </div>

        {loading && !table ? (
          <div className="mt-6 space-y-3">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div key={idx} className="h-12 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : table ? (
          <div className="mt-5 grid gap-3 sm:mt-6 sm:gap-4 md:grid-cols-2">
            <div className="min-w-0 rounded-xl border border-slate-200 p-3 sm:p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Table Number</p>
              <p className="mt-1 break-words text-lg font-semibold text-slate-900">{table.tableNumber}</p>
            </div>
            <div className="min-w-0 rounded-xl border border-slate-200 p-3 sm:p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Current Status</p>
              <div className="mt-2"><TableStatusBadge status={table.status} /></div>
            </div>
            <div className="min-w-0 rounded-xl border border-slate-200 p-3 sm:p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Capacity</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{table.capacity} Guests</p>
            </div>
            <div className="min-w-0 rounded-xl border border-slate-200 p-3 sm:p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Floor / Section</p>
              <p className="mt-1 break-words text-lg font-semibold text-slate-900">{table.floor} / {table.section}</p>
            </div>
            <div className="min-w-0 rounded-xl border border-slate-200 p-3 sm:p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Shape</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{table.shape}</p>
            </div>
            <div className="min-w-0 rounded-xl border border-slate-200 p-3 sm:p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Current Customer</p>
              <p className="mt-1 text-sm text-slate-800">{table.currentCustomer?.fullName || "-"}</p>
              <p className="text-xs text-slate-500">{table.currentCustomer?.email || ""}</p>
            </div>

            <div className="min-w-0 rounded-xl border border-slate-200 p-3 sm:p-4 md:col-span-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Current Order</p>
              {table.currentOrder ? (
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-800">
                  <p className="break-words font-semibold">{table.currentOrder.orderNumber ? `#${table.currentOrder.orderNumber}` : "Active order"}</p>
                  {table.currentOrder.status ? <p>Order: {String(table.currentOrder.status).replaceAll("_", " ")}</p> : null}
                  {typeof table.currentOrder.total === "number" ? <p className="font-semibold">{currency(table.currentOrder.total)}</p> : null}
                  {(table.currentOrder.kitchenStatus || table.currentOrder.kotStatus) ? <p>Kitchen: {String(table.currentOrder.kitchenStatus || table.currentOrder.kotStatus).replaceAll("_", " ")}</p> : null}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No active order.</p>
              )}
            </div>

            <div className="min-w-0 rounded-xl border border-slate-200 p-3 sm:p-4 md:col-span-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">Active Orders ({activeOrderCount})</p>
              {visibleActiveOrders.length ? (
                <ul className="mt-2 space-y-1 text-sm text-slate-800">
                  {visibleActiveOrders.map((order) => (
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

            <div className="min-w-0 rounded-xl border border-slate-200 p-3 sm:p-4 md:col-span-2">
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

            <div className="grid min-w-0 grid-cols-1 gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-2 sm:gap-3 sm:p-4 md:col-span-2">
              {status === "AVAILABLE" && (
                <button
                  type="button"
                  onClick={handleCreateOrder}
                  className="min-h-11 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800"
                >
                  Create New Order
                </button>
              )}
              {hasActiveOrder && (
                <button
                  type="button"
                  onClick={handleViewOrder}
                  className="min-h-11 rounded-xl border border-brand-200 bg-brand-50 px-4 text-sm font-medium text-brand-700 hover:bg-brand-100"
                >
                  View Active Order
                </button>
              )}
              <button
                type="button"
                onClick={openQr}
                className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Show QR Code
              </button>
              <button
                type="button"
                onClick={() => onClose?.()}
                className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            {qrOpen && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-3 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="table-qr-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setQrOpen(false); }}>
                <div className="max-h-[90dvh] w-full max-w-[calc(100vw-1.5rem)] overflow-y-auto overscroll-contain rounded-2xl bg-white p-4 shadow-2xl sm:max-w-md sm:p-6">
                  <div className="flex items-center justify-between">
                    <h3 id="table-qr-title" className="text-lg font-bold text-slate-900">Table QR Code</h3>
                    <button type="button" onClick={() => setQrOpen(false)} className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-700">Close</button>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">Scan this QR to order for Table {table.tableNumber}</p>
                  <div className="mt-4 flex items-center justify-center">
                    {qrLoading && <p className="text-sm text-slate-500">Loading QR...</p>}
                    {qrError && <p className="text-sm text-rose-600">{qrError}</p>}
                    {!qrLoading && !qrError && qrCode && (
                      <img
                        src={qrCode}
                        alt={`QR for table ${table.tableNumber}`}
                        className="h-auto max-h-64 w-auto max-w-full rounded-xl border border-slate-200"
                        onError={() => {
                          setQrCode("");
                          setQrError("Unable to display QR code");
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="mt-6 text-sm text-rose-600">Unable to load table details.</p>
        )}
      </div>
    </div>
  );
};

export default memo(TableDetails);
