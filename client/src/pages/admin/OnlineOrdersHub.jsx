import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FiCheck, FiChevronLeft, FiChevronRight, FiClock, FiPackage, FiRefreshCw, FiSearch, FiTruck, FiX } from "react-icons/fi";
import { useSocket } from "../../context/SocketContext";
import OrderStatusBadge from "../../components/admin/orders/OrderStatusBadge";
import { bulkReadyKitchenItems, bulkStartKitchenItems } from "../../services/kitchenService";
import { getOrderById, getOrderStats, getOrders, updateOrderStatus } from "../../services/orderService";
import { currency, dateTime } from "../../utils/format";
import { paymentBadgeClasses, paymentStatusLabel } from "../../utils/paymentUtils";

const STATUS_OPTIONS = ["PENDING", "CONFIRMED", "PREPARING", "READY", "OUT_FOR_DELIVERY", "COMPLETED", "CANCELLED", "REJECTED"];
const SOURCE_OPTIONS = ["ONLINE", "DELIVERY", "PICKUP"];

const label = (value) => String(value || "-").replaceAll("_", " ");

const HubStat = ({ label: title, value, tone, icon }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p><p className="mt-2 text-2xl font-bold text-slate-900">{value ?? "–"}</p></div>
      <span className={`rounded-xl p-2 ${tone}`}>{icon}</span>
    </div>
  </div>
);

const OnlineOrderDetails = ({ order, loading, onClose, onAction, busy }) => {
  if (!order) return null;
  const canDispatch = order.status === "READY" && order.orderType === "DELIVERY";
  const canPickupComplete = order.status === "READY" && order.orderType === "PICKUP";
  const canDeliveryComplete = order.status === "OUT_FOR_DELIVERY";
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/45" role="dialog" aria-modal="true" aria-label="Online order details">
      <section className="h-full w-full max-w-2xl overflow-y-auto bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold text-slate-900">Online order details</h2><p className="mt-1 text-sm text-slate-500">#{order.orderNumber}</p></div><button onClick={onClose} className="rounded-lg border border-slate-300 p-2 text-slate-600" aria-label="Close details"><FiX /></button></div>
        {loading ? <div className="mt-5 h-80 animate-pulse rounded-2xl bg-slate-100" /> : <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4"><div><OrderStatusBadge status={order.status} /><p className="mt-2 text-sm text-slate-600">Created {dateTime(order.createdAt)}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{label(order.orderSource || order.orderType)}</span></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-700"><h3 className="mb-2 font-semibold text-slate-900">Order information</h3><p>Type: {label(order.orderType)}</p><p>Payment: <span className={`ml-1 inline-flex rounded-full border px-2 py-0.5 text-xs ${paymentBadgeClasses(order.paymentStatus)}`}>{paymentStatusLabel(order.paymentStatus)}</span></p><p className="mt-1">Expected time: {order.expectedAt ? dateTime(order.expectedAt) : "Not provided"}</p></div>
            <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-700"><h3 className="mb-2 font-semibold text-slate-900">Customer information</h3><p>{order.customer?.fullName || "Guest customer"}</p><p>{order.customer?.phone || "Phone not provided"}</p>{order.deliveryAddress ? <p className="mt-1 break-words">{order.deliveryAddress}</p> : null}{order.pickupDetails ? <p className="mt-1">{order.pickupDetails}</p> : null}</div>
          </div>
          <div className="rounded-xl border border-slate-200 p-4"><h3 className="font-semibold text-slate-900">Items</h3><div className="mt-3 space-y-3">{(order.items || []).map((item, index) => <div key={`${item.menuItem?._id || item.menuItem || item.name}-${index}`} className="flex justify-between gap-3 text-sm"><div><p className="font-medium text-slate-800">{item.name || item.menuItem?.name}</p><p className="text-slate-500">{currency(item.price)} × {item.quantity}{item.specialInstructions ? ` · ${item.specialInstructions}` : ""}</p></div><p className="font-semibold text-slate-900">{currency(item.subtotal || item.price * item.quantity)}</p></div>)}</div></div>
          <div className="rounded-xl border border-slate-200 p-4 text-sm text-slate-700"><h3 className="mb-2 font-semibold text-slate-900">Summary</h3><p className="flex justify-between"><span>Subtotal</span><span>{currency(order.subtotal)}</span></p><p className="flex justify-between"><span>Tax</span><span>{currency(order.tax)}</span></p><p className="flex justify-between"><span>Discount</span><span>-{currency(order.discount)}</span></p><p className="flex justify-between"><span>Delivery charge</span><span>{currency(order.deliveryCharge)}</span></p><p className="mt-2 flex justify-between border-t border-slate-200 pt-2 font-bold text-slate-900"><span>Grand total</span><span>{currency(order.total)}</span></p></div>
          {order.rejectionReason ? <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700"><strong>Rejection reason:</strong> {order.rejectionReason}</p> : null}
          <div className="flex flex-wrap justify-end gap-2">{canDispatch ? <button disabled={busy} onClick={() => onAction(order, "dispatch")} className="rounded-xl bg-cyan-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">Dispatch order</button> : null}{canPickupComplete || canDeliveryComplete ? <button disabled={busy} onClick={() => onAction(order, "complete")} className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">Complete order</button> : null}</div>
        </div>}
      </section>
    </div>
  );
};

const OnlineOrdersHub = () => {
  const socket = useSocket();
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState(null);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [filters, setFilters] = useState({ search: "", status: "", orderType: "", paymentStatus: "", orderSource: "", date: "", page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = { onlineOnly: true, page: filters.page, limit: 20, sortBy: "newest" };
      ["search", "status", "orderType", "paymentStatus", "orderSource", "date"].forEach((key) => { if (filters[key]) params[key] = filters[key]; });
      const [{ data: ordersData }, { data: statsData }] = await Promise.all([getOrders(params), getOrderStats({ onlineOnly: true })]);
      setOrders(ordersData.data || []); setMeta(ordersData.meta || { page: 1, limit: 20, total: 0, totalPages: 1 }); setStats(statsData.data || null);
    } catch (requestError) { setError(requestError?.response?.data?.message || "Unable to load online orders."); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!socket) return undefined;
    let timer;
    const refresh = () => { clearTimeout(timer); timer = setTimeout(load, 250); };
    ["order:new", "order:created", "order:status", "order:statusChanged", "order:cancelled", "order:paymentUpdated", "kitchen:orderStatusChanged"].forEach((event) => socket.on(event, refresh));
    return () => { clearTimeout(timer); ["order:new", "order:created", "order:status", "order:statusChanged", "order:cancelled", "order:paymentUpdated", "kitchen:orderStatusChanged"].forEach((event) => socket.off(event, refresh)); };
  }, [socket, load]);

  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value, page: key === "page" ? value : 1 }));
  const openDetails = async (order) => { setSelected(order); setDetailsLoading(true); try { const { data } = await getOrderById(order._id); setSelected(data.data); } catch (err) { toast.error(err?.response?.data?.message || "Unable to load order details"); } finally { setDetailsLoading(false); } };
  const runAction = async (order, action) => {
    if (!order?._id || busyId) return;
    setBusyId(order._id);
    try {
      if (action === "accept") await updateOrderStatus(order._id, "CONFIRMED");
      if (action === "start") await bulkStartKitchenItems(order._id);
      if (action === "ready") await bulkReadyKitchenItems(order._id);
      if (action === "dispatch") await updateOrderStatus(order._id, "OUT_FOR_DELIVERY");
      if (action === "complete") await updateOrderStatus(order._id, "COMPLETED");
      if (action === "cancel") await updateOrderStatus(order._id, "CANCELLED");
      if (action === "reject") await updateOrderStatus(order._id, "REJECTED", { rejectionReason: reason.trim() });
      toast.success(action === "accept" ? "Order accepted and sent to kitchen" : "Order updated");
      setRejecting(null); setReason(""); await load();
      if (selected?._id === order._id) { const { data } = await getOrderById(order._id); setSelected(data.data); }
    } catch (requestError) { toast.error(requestError?.response?.data?.message || "Unable to update this order"); }
    finally { setBusyId(""); }
  };

  const cards = useMemo(() => [
    ["New orders", stats?.newOrders, "bg-amber-50 text-amber-700", <FiClock />], ["Accepted", stats?.accepted, "bg-sky-50 text-sky-700", <FiCheck />], ["Preparing", stats?.preparing, "bg-violet-50 text-violet-700", <FiPackage />], ["Ready", stats?.ready, "bg-indigo-50 text-indigo-700", <FiCheck />], ["Out for delivery", stats?.outForDelivery, "bg-cyan-50 text-cyan-700", <FiTruck />], ["Completed", stats?.completed, "bg-emerald-50 text-emerald-700", <FiCheck />],
  ], [stats]);

  return <div className="space-y-5 pb-20">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Online Orders Hub</h1><p className="mt-1 text-sm text-slate-500">Receive, prepare, dispatch and complete online delivery and pickup orders.</p></div><button onClick={load} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"><FiRefreshCw className={loading ? "animate-spin" : ""} />Refresh</button></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{cards.map(([title, value, tone, icon]) => <HubStat key={title} label={title} value={value} tone={tone} icon={icon} />)}</div>
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6"><label className="relative xl:col-span-2"><FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={filters.search} onChange={(e) => updateFilter("search", e.target.value)} placeholder="Order, customer or phone" className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-sm" /></label><select value={filters.status} onChange={(e) => updateFilter("status", e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"><option value="">All statuses</option>{STATUS_OPTIONS.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select><select value={filters.orderType} onChange={(e) => updateFilter("orderType", e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"><option value="">All types</option><option value="DELIVERY">Delivery</option><option value="PICKUP">Pickup</option></select><select value={filters.paymentStatus} onChange={(e) => updateFilter("paymentStatus", e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"><option value="">All payments</option><option value="PENDING">Pending</option><option value="PAID">Paid</option><option value="FAILED">Failed</option><option value="REFUNDED">Refunded</option></select><select value={filters.orderSource} onChange={(e) => updateFilter("orderSource", e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm"><option value="">All sources</option>{SOURCE_OPTIONS.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></div><input type="date" value={filters.date} onChange={(e) => updateFilter("date", e.target.value)} className="mt-3 rounded-xl border border-slate-300 px-3 py-2.5 text-sm" /></div>
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-[960px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{["Order", "Customer", "Source / type", "Items", "Payment", "Status", "Time", "Actions"].map((heading) => <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan="8" className="px-4 py-12 text-center text-slate-500">Loading online orders…</td></tr> : error ? <tr><td colSpan="8" className="px-4 py-12 text-center text-rose-600">{error}</td></tr> : !orders.length ? <tr><td colSpan="8" className="px-4 py-12 text-center text-slate-500">No online orders match these filters.</td></tr> : orders.map((order) => <tr key={order._id} className="hover:bg-slate-50"><td className="px-4 py-3"><button onClick={() => openDetails(order)} className="font-semibold text-brand-700 hover:underline">#{order.orderNumber}</button><p className="mt-0.5 text-xs text-slate-500">{currency(order.total)}</p></td><td className="px-4 py-3"><p className="font-medium text-slate-800">{order.customer?.fullName || "Guest customer"}</p><p className="text-xs text-slate-500">{order.customer?.phone || "—"}</p></td><td className="px-4 py-3"><p>{label(order.orderSource || order.orderType)}</p><p className="text-xs text-slate-500">{label(order.orderType)}</p></td><td className="px-4 py-3">{(order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)}</td><td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2 py-1 text-xs ${paymentBadgeClasses(order.paymentStatus)}`}>{paymentStatusLabel(order.paymentStatus)}</span></td><td className="px-4 py-3"><OrderStatusBadge status={order.status} /></td><td className="px-4 py-3 text-slate-600">{dateTime(order.createdAt)}</td><td className="px-4 py-3"><div className="flex flex-wrap gap-2">{order.status === "PENDING" ? <><button disabled={busyId === order._id} onClick={() => runAction(order, "accept")} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">Accept</button><button disabled={busyId === order._id} onClick={() => { setRejecting(order); setReason(""); }} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-60">Reject</button></> : null}{order.status === "CONFIRMED" ? <button disabled={busyId === order._id} onClick={() => runAction(order, "start")} className="rounded-lg bg-violet-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">Start prep</button> : null}{order.status === "PREPARING" ? <button disabled={busyId === order._id} onClick={() => runAction(order, "ready")} className="rounded-lg bg-indigo-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">Mark ready</button> : null}{order.status === "READY" && order.orderType === "DELIVERY" ? <button disabled={busyId === order._id} onClick={() => runAction(order, "dispatch")} className="rounded-lg bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">Dispatch</button> : null}{order.status === "READY" && order.orderType === "PICKUP" ? <button disabled={busyId === order._id} onClick={() => runAction(order, "complete")} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">Complete</button> : null}{order.status === "OUT_FOR_DELIVERY" ? <button disabled={busyId === order._id} onClick={() => runAction(order, "complete")} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">Complete</button> : null}<button onClick={() => openDetails(order)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700">Details</button></div></td></tr>)}</tbody></table></div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600"><span>Showing {(meta.page - 1) * meta.limit + (orders.length ? 1 : 0)}–{(meta.page - 1) * meta.limit + orders.length} of {meta.total}</span><div className="flex gap-2"><button onClick={() => updateFilter("page", meta.page - 1)} disabled={meta.page <= 1} className="rounded-lg border border-slate-300 p-2 disabled:opacity-40" aria-label="Previous page"><FiChevronLeft /></button><button onClick={() => updateFilter("page", meta.page + 1)} disabled={meta.page >= meta.totalPages} className="rounded-lg border border-slate-300 p-2 disabled:opacity-40" aria-label="Next page"><FiChevronRight /></button></div></div></div>
    {rejecting ? <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"><h2 className="text-lg font-bold text-slate-900">Reject order #{rejecting.orderNumber}</h2><p className="mt-1 text-sm text-slate-500">Give the customer-facing operational reason for this rejection.</p><textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} maxLength="500" className="mt-4 min-h-24 w-full rounded-xl border border-slate-300 p-3 text-sm" placeholder="For example: a requested item is unavailable" /><div className="mt-4 flex justify-end gap-2"><button onClick={() => setRejecting(null)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm">Cancel</button><button disabled={!reason.trim() || Boolean(busyId)} onClick={() => runAction(rejecting, "reject")} className="rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">Reject order</button></div></div></div> : null}
    <OnlineOrderDetails order={selected} loading={detailsLoading} onClose={() => setSelected(null)} onAction={runAction} busy={Boolean(busyId)} />
  </div>;
};

export default OnlineOrdersHub;
