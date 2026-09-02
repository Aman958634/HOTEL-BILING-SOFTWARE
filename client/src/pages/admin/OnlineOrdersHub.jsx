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
const itemCount = (order) => (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);

const elapsedTime = (value) => {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
};

const HubStat = ({ label: title, value, tone, icon }) => (
  <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
    <div className="flex min-w-0 items-start justify-between gap-3">
      <div className="min-w-0"><p className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p><p className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">{value ?? "—"}</p></div>
      <span className={`shrink-0 rounded-xl p-2 ${tone}`} aria-hidden="true">{icon}</span>
    </div>
  </article>
);

const OrderActions = ({ order, busy, onAction, onReject, onOpen }) => (
  <div className="flex flex-wrap gap-2">
    {order.status === "PENDING" ? <><button type="button" disabled={busy} onClick={() => onAction(order, "accept")} className="min-h-9 rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white disabled:opacity-60">{busy ? "Processing…" : "Accept"}</button><button type="button" disabled={busy} onClick={() => onReject(order)} className="min-h-9 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700 disabled:opacity-60">Reject</button></> : null}
    {order.status === "CONFIRMED" ? <button type="button" disabled={busy} onClick={() => onAction(order, "start")} className="min-h-9 rounded-lg bg-violet-700 px-3 text-xs font-semibold text-white disabled:opacity-60">{busy ? "Processing…" : "Start prep"}</button> : null}
    {order.status === "PREPARING" ? <button type="button" disabled={busy} onClick={() => onAction(order, "ready")} className="min-h-9 rounded-lg bg-indigo-700 px-3 text-xs font-semibold text-white disabled:opacity-60">{busy ? "Processing…" : "Mark ready"}</button> : null}
    {order.status === "READY" && order.orderType === "DELIVERY" ? <button type="button" disabled={busy} onClick={() => onAction(order, "dispatch")} className="min-h-9 rounded-lg bg-cyan-700 px-3 text-xs font-semibold text-white disabled:opacity-60">{busy ? "Processing…" : "Dispatch"}</button> : null}
    {((order.status === "READY" && order.orderType === "PICKUP") || order.status === "OUT_FOR_DELIVERY") ? <button type="button" disabled={busy} onClick={() => onAction(order, "complete")} className="min-h-9 rounded-lg bg-emerald-700 px-3 text-xs font-semibold text-white disabled:opacity-60">{busy ? "Processing…" : "Complete"}</button> : null}
    <button type="button" onClick={() => onOpen(order)} className="min-h-9 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">Open</button>
  </div>
);

const OnlineOrderCard = ({ order, busy, onAction, onReject, onOpen }) => (
  <article className={`min-w-0 rounded-2xl border bg-white p-3 shadow-sm sm:p-4 ${order.status === "PENDING" ? "border-amber-300 ring-1 ring-amber-100" : "border-slate-200"}`}>
    <div className="flex min-w-0 items-start justify-between gap-3">
      <div className="min-w-0"><p className="break-words text-base font-semibold text-slate-900">#{order.orderNumber}</p><p className="mt-0.5 break-words text-xs text-slate-500">{label(order.orderSource || order.orderType)} · {order.table?.tableNumber ? `Table ${order.table.tableNumber}` : order.customer?.fullName || "Guest customer"}</p></div>
      <div className="shrink-0"><OrderStatusBadge status={order.status} /></div>
    </div>
    <dl className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-2.5 text-sm">
      <div className="min-w-0"><dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Amount</dt><dd className="mt-0.5 truncate font-semibold text-slate-900">{currency(order.total)}</dd></div>
      <div className="min-w-0"><dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Items</dt><dd className="mt-0.5 font-semibold text-slate-900">{itemCount(order)}</dd></div>
    </dl>
    <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-xs text-slate-500">
      {order.kitchenStatus ? <span>Kitchen: {label(order.kitchenStatus)}</span> : null}
      {order.kitchenStatus && elapsedTime(order.createdAt) ? <span aria-hidden="true">·</span> : null}
      {elapsedTime(order.createdAt) ? <span>{elapsedTime(order.createdAt)}</span> : null}
      {order.customer?.phone ? <><span aria-hidden="true">·</span><span>{order.customer.phone}</span></> : null}
    </div>
    <div className="mt-3"><OrderActions order={order} busy={busy} onAction={onAction} onReject={onReject} onOpen={onOpen} /></div>
  </article>
);

const OnlineOrderDetails = ({ order, loading, onClose, onAction, onReject, onOpen, busy }) => {
  useEffect(() => {
    if (!order) return undefined;
    const closeOnEscape = (event) => { if (event.key === "Escape") onClose(); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose, order]);
  if (!order) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 p-0 sm:p-3" role="dialog" aria-modal="true" aria-labelledby="online-order-details-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="h-full w-full max-w-2xl overflow-y-auto overscroll-contain bg-white p-4 shadow-2xl sm:max-h-[calc(100dvh-1.5rem)] sm:rounded-2xl sm:p-6">
        <div className="flex min-w-0 items-start justify-between gap-4"><div className="min-w-0"><h2 id="online-order-details-title" className="text-xl font-bold text-slate-900">Online order</h2><p className="mt-1 break-words text-sm text-slate-500">#{order.orderNumber}</p></div><button type="button" onClick={onClose} className="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">Close</button></div>
        {loading ? <div className="mt-5 space-y-3">{Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}</div> : <div className="mt-5 space-y-4">
          <div className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-lg font-semibold text-slate-900">{currency(order.total)}</p><p className="mt-1 text-sm text-slate-600">{label(order.orderSource || order.orderType)}{order.table?.tableNumber ? ` · Table ${order.table.tableNumber}` : ""}</p></div><OrderStatusBadge status={order.status} /></div><div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">{order.kitchenStatus ? <span>Kitchen: {label(order.kitchenStatus)}</span> : null}{elapsedTime(order.createdAt) ? <span>Received {elapsedTime(order.createdAt)} ago</span> : null}<span>{dateTime(order.createdAt)}</span></div></div>
          <div className="grid gap-3 sm:grid-cols-2"><section className="rounded-xl border border-slate-200 p-4 text-sm text-slate-700"><h3 className="mb-2 font-semibold text-slate-900">Order context</h3><p>Type: {label(order.orderType)}</p><p className="mt-1">Payment: <span className={`ml-1 inline-flex rounded-full border px-2 py-0.5 text-xs ${paymentBadgeClasses(order.paymentStatus)}`}>{paymentStatusLabel(order.paymentStatus)}</span></p>{order.expectedAt ? <p className="mt-1">Expected: {dateTime(order.expectedAt)}</p> : null}</section><section className="min-w-0 rounded-xl border border-slate-200 p-4 text-sm text-slate-700"><h3 className="mb-2 font-semibold text-slate-900">Customer</h3><p className="break-words">{order.customer?.fullName || "Guest customer"}</p>{order.customer?.phone ? <p className="mt-1 break-words">{order.customer.phone}</p> : null}{order.deliveryAddress ? <p className="mt-2 break-words text-xs text-slate-500">{order.deliveryAddress}</p> : null}{order.pickupDetails ? <p className="mt-2 break-words text-xs text-slate-500">{order.pickupDetails}</p> : null}</section></div>
          <section className="rounded-xl border border-slate-200 p-4"><h3 className="font-semibold text-slate-900">Items</h3><div className="mt-3 space-y-3">{(order.items || []).map((item, index) => <div key={`${item.menuItem?._id || item.menuItem || item.name}-${index}`} className="flex min-w-0 justify-between gap-3 text-sm"><div className="min-w-0"><p className="break-words font-medium text-slate-800">{item.name || item.menuItem?.name || "Item"}</p><p className="text-xs text-slate-500">{item.quantity} × {currency(item.price)}</p>{item.specialInstructions ? <p className="mt-0.5 break-words text-xs text-slate-500">{item.specialInstructions}</p> : null}</div><p className="shrink-0 font-semibold text-slate-900">{currency(item.subtotal || item.price * item.quantity)}</p></div>)}</div></section>
          <section className="rounded-xl border border-slate-200 p-4 text-sm text-slate-700"><h3 className="mb-2 font-semibold text-slate-900">Financial summary</h3><p className="flex justify-between gap-3"><span>Subtotal</span><span>{currency(order.subtotal)}</span></p><p className="mt-1 flex justify-between gap-3"><span>Tax</span><span>{currency(order.tax)}</span></p><p className="mt-1 flex justify-between gap-3"><span>Discount</span><span>-{currency(order.discount)}</span></p><p className="mt-1 flex justify-between gap-3"><span>Delivery charge</span><span>{currency(order.deliveryCharge)}</span></p><p className="mt-3 flex justify-between gap-3 border-t border-slate-200 pt-3 font-bold text-slate-900"><span>Grand total</span><span>{currency(order.total)}</span></p></section>
          {order.rejectionReason ? <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700"><strong>Rejection reason:</strong> {order.rejectionReason}</p> : null}
          <div className="border-t border-slate-200 pt-4"><OrderActions order={order} busy={busy} onAction={onAction} onReject={onReject} onOpen={onOpen} /></div>
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
      setOrders(ordersData.data || []); setMeta(ordersData.meta || { page: filters.page, limit: 20, total: 0, totalPages: 1 }); setStats(statsData.data || null);
    } catch (requestError) { setError(requestError?.response?.data?.message || "Unable to load online orders."); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!socket) return undefined;
    let timer;
    const refresh = () => { clearTimeout(timer); timer = setTimeout(load, 250); };
    const events = ["order:new", "order:created", "order:status", "order:statusChanged", "order:cancelled", "order:paymentUpdated", "kitchen:orderStatusChanged"];
    events.forEach((event) => socket.on(event, refresh));
    return () => { clearTimeout(timer); events.forEach((event) => socket.off(event, refresh)); };
  }, [socket, load]);

  const updateFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value, page: key === "page" ? value : 1 }));
  const openDetails = async (order) => { setSelected(order); setDetailsLoading(true); try { const { data } = await getOrderById(order._id); setSelected(data.data); } catch (err) { toast.error(err?.response?.data?.message || "Unable to load order details"); } finally { setDetailsLoading(false); } };
  const openReject = (order) => { setRejecting(order); setReason(""); };
  const runAction = async (order, action) => {
    if (!order?._id || busyId) return;
    setBusyId(order._id);
    try {
      if (action === "accept") await updateOrderStatus(order._id, "CONFIRMED");
      if (action === "start") await bulkStartKitchenItems(order._id);
      if (action === "ready") await bulkReadyKitchenItems(order._id);
      if (action === "dispatch") await updateOrderStatus(order._id, "OUT_FOR_DELIVERY");
      if (action === "complete") await updateOrderStatus(order._id, "COMPLETED");
      if (action === "reject") await updateOrderStatus(order._id, "REJECTED", { rejectionReason: reason.trim() });
      toast.success(action === "accept" ? "Order accepted and sent to kitchen" : "Order updated");
      setRejecting(null); setReason(""); await load();
      if (selected?._id === order._id) { const { data } = await getOrderById(order._id); setSelected(data.data); }
    } catch (requestError) { toast.error(requestError?.response?.data?.message || "Unable to update this order"); }
    finally { setBusyId(""); }
  };

  const cards = useMemo(() => [["New", stats?.newOrders, "bg-amber-50 text-amber-700", <FiClock />], ["Accepted", stats?.accepted, "bg-sky-50 text-sky-700", <FiCheck />], ["Preparing", stats?.preparing, "bg-violet-50 text-violet-700", <FiPackage />], ["Ready", stats?.ready, "bg-indigo-50 text-indigo-700", <FiCheck />], ["Out for delivery", stats?.outForDelivery, "bg-cyan-50 text-cyan-700", <FiTruck />], ["Completed", stats?.completed, "bg-emerald-50 text-emerald-700", <FiCheck />]], [stats]);
  const prioritizedOrders = useMemo(() => [...orders].sort((a, b) => (a.status === "PENDING" ? -1 : 0) - (b.status === "PENDING" ? -1 : 0)), [orders]);
  const attentionCount = orders.filter((order) => order.status === "PENDING").length;

  return <div className="space-y-4 pb-20">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Online Orders</h1><p className="mt-1 text-sm text-slate-500">Review incoming delivery and pickup orders, current kitchen progress and next actions.</p></div><button type="button" onClick={load} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"><FiRefreshCw className={loading ? "animate-spin" : ""} aria-hidden="true" />Refresh</button></div>
    <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 xl:grid-cols-6">{cards.map(([title, value, tone, icon]) => <HubStat key={title} label={title} value={value} tone={tone} icon={icon} />)}</div>
    {attentionCount > 0 ? <section className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:flex sm:items-center sm:justify-between sm:gap-3"><div><p className="font-semibold">Needs attention</p><p className="mt-0.5 text-amber-800">{attentionCount} pending {attentionCount === 1 ? "order is" : "orders are"} shown first in this queue.</p></div><button type="button" onClick={() => updateFilter("status", "PENDING")} className="mt-2 min-h-10 rounded-xl border border-amber-300 bg-white px-3 text-sm font-semibold text-amber-800 hover:bg-amber-100 sm:mt-0">View pending</button></section> : null}
    <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4" aria-label="Online order filters"><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6 xl:gap-3"><label className="relative min-w-0 sm:col-span-2 xl:col-span-2"><span className="sr-only">Search online orders</span><FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input value={filters.search} onChange={(e) => updateFilter("search", e.target.value)} placeholder="Order, customer or phone" className="min-h-11 w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15" /></label><select value={filters.status} onChange={(e) => updateFilter("status", e.target.value)} className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm"><option value="">All statuses</option>{STATUS_OPTIONS.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select><select value={filters.orderType} onChange={(e) => updateFilter("orderType", e.target.value)} className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm"><option value="">All types</option><option value="DELIVERY">Delivery</option><option value="PICKUP">Pickup</option></select><select value={filters.orderSource} onChange={(e) => updateFilter("orderSource", e.target.value)} className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm"><option value="">All sources</option>{SOURCE_OPTIONS.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select><select value={filters.paymentStatus} onChange={(e) => updateFilter("paymentStatus", e.target.value)} className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm"><option value="">All payments</option><option value="PENDING">Pending</option><option value="PAID">Paid</option><option value="FAILED">Failed</option><option value="REFUNDED">Refunded</option></select></div><input type="date" value={filters.date} onChange={(e) => updateFilter("date", e.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm sm:w-auto" aria-label="Filter online orders by date" /></section>
    {error ? <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><p className="font-semibold">Unable to load online orders</p><p className="mt-1">{error}</p><button type="button" onClick={load} className="mt-3 min-h-10 rounded-xl border border-rose-200 bg-white px-3 text-sm font-semibold text-rose-700">Retry</button></section> : null}
    <div className="grid gap-3 lg:hidden" aria-busy={loading}>{loading ? Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-52 animate-pulse rounded-2xl bg-slate-100" />) : !error && !prioritizedOrders.length ? <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">No online orders match these filters.</p> : prioritizedOrders.map((order) => <OnlineOrderCard key={order._id} order={order} busy={busyId === order._id} onAction={runAction} onReject={openReject} onOpen={openDetails} />)}</div>
    {!error ? <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:block"><div className="overflow-x-auto"><table className="min-w-[1080px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{["Order", "Source / table", "Customer", "Items", "Amount", "Status", "Kitchen", "Created", "Actions"].map((heading) => <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan="9" className="px-4 py-12 text-center text-slate-500">Loading online orders…</td></tr> : !prioritizedOrders.length ? <tr><td colSpan="9" className="px-4 py-12 text-center text-slate-500">No online orders match these filters.</td></tr> : prioritizedOrders.map((order) => <tr key={order._id} className={order.status === "PENDING" ? "bg-amber-50/60" : "hover:bg-slate-50"}><td className="px-4 py-3"><button type="button" onClick={() => openDetails(order)} className="font-semibold text-brand-700 hover:underline">#{order.orderNumber}</button></td><td className="px-4 py-3"><p>{label(order.orderSource || order.orderType)}</p><p className="text-xs text-slate-500">{order.table?.tableNumber ? `Table ${order.table.tableNumber}` : label(order.orderType)}</p></td><td className="px-4 py-3"><p className="font-medium text-slate-800">{order.customer?.fullName || "Guest customer"}</p>{order.customer?.phone ? <p className="text-xs text-slate-500">{order.customer.phone}</p> : null}</td><td className="px-4 py-3">{itemCount(order)}</td><td className="px-4 py-3 font-semibold text-slate-900">{currency(order.total)}</td><td className="px-4 py-3"><OrderStatusBadge status={order.status} /></td><td className="px-4 py-3">{order.kitchenStatus ? label(order.kitchenStatus) : "—"}</td><td className="px-4 py-3 text-slate-600"><p>{elapsedTime(order.createdAt) || "—"}</p><p className="text-xs">{dateTime(order.createdAt)}</p></td><td className="px-4 py-3"><OrderActions order={order} busy={busyId === order._id} onAction={runAction} onReject={openReject} onOpen={openDetails} /></td></tr>)}</tbody></table></div>{(meta.totalPages || 1) > 1 ? <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600"><span>Showing {(meta.page - 1) * meta.limit + (orders.length ? 1 : 0)}–{(meta.page - 1) * meta.limit + orders.length} of {meta.total}</span><div className="flex gap-2"><button type="button" onClick={() => updateFilter("page", meta.page - 1)} disabled={meta.page <= 1} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 disabled:opacity-40" aria-label="Previous page"><FiChevronLeft /></button><button type="button" onClick={() => updateFilter("page", meta.page + 1)} disabled={meta.page >= meta.totalPages} className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 disabled:opacity-40" aria-label="Next page"><FiChevronRight /></button></div></div> : null}</div> : null}
    {rejecting ? <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-3 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="reject-online-order-title"><div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl sm:p-5"><h2 id="reject-online-order-title" className="text-lg font-bold text-slate-900">Reject order #{rejecting.orderNumber}</h2><p className="mt-1 text-sm text-slate-500">Give the customer-facing operational reason for this rejection.</p><textarea autoFocus value={reason} onChange={(e) => setReason(e.target.value)} maxLength="500" className="mt-4 min-h-24 w-full rounded-xl border border-slate-300 p-3 text-sm" placeholder="For example: a requested item is unavailable" /><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" disabled={Boolean(busyId)} onClick={() => setRejecting(null)} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm">Cancel</button><button type="button" disabled={!reason.trim() || Boolean(busyId)} onClick={() => runAction(rejecting, "reject")} className="min-h-11 rounded-xl bg-rose-700 px-4 text-sm font-semibold text-white disabled:opacity-60">{busyId ? "Rejecting…" : "Reject order"}</button></div></div></div> : null}
    <OnlineOrderDetails order={selected} loading={detailsLoading} onClose={() => setSelected(null)} onAction={runAction} onReject={openReject} onOpen={openDetails} busy={Boolean(busyId)} />
  </div>;
};

export default OnlineOrdersHub;
