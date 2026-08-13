import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import CashPaymentConfirmationModal from "../../components/admin/orders/CashPaymentConfirmationModal";
import CreateOrderModal from "../../components/admin/orders/CreateOrderModal";
import EditOrderModal from "../../components/admin/orders/EditOrderModal";
import OrderDetailsDrawer from "../../components/admin/orders/OrderDetailsDrawer";
import OrderPaymentPromptModal from "../../components/admin/orders/OrderPaymentPromptModal";
import OrderStats from "../../components/admin/orders/OrderStats";
import OrderTable from "../../components/admin/orders/OrderTable";
import OrderToolbar from "../../components/admin/orders/OrderToolbar";
import { useSocket } from "../../context/SocketContext";
import { getAdminCategories } from "../../services/categoryService";
import { getAdminMenu } from "../../services/menuService";
import {
  createOrder,
  deleteOrder,
  getOrderById,
  getOrderStats,
  getOrders,
  payOrder,
  updateOrder,
  updateOrderStatus,
} from "../../services/orderService";
import { createGatewayPayment, getPaymentByOrderId, verifyGatewayPayment } from "../../services/paymentService";
import { getTables } from "../../services/tableService";

const STATUS_TRANSITIONS = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["SERVED", "CANCELLED"],
  SERVED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

const loadRazorpayScript = () =>
  new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = resolve;
    script.onerror = reject;
    document.body.appendChild(script);
  });

const OrderManagement = () => {
  const socket = useSocket();

  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    orderType: "",
    paymentStatus: "",
    date: "",
    sortBy: "newest",
    page: 1,
  });

  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [dependenciesLoading, setDependenciesLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [foods, setFoods] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tables, setTables] = useState([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editOrder, setEditOrder] = useState(null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsOrder, setDetailsOrder] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [paidOrderReceipt, setPaidOrderReceipt] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [statusValue, setStatusValue] = useState("");

  const [createdOrder, setCreatedOrder] = useState(null);
  const [paymentPromptOpen, setPaymentPromptOpen] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [cashConfirmOpen, setCashConfirmOpen] = useState(false);
  const [cashConfirmLoading, setCashConfirmLoading] = useState(false);

  const selectedStatusOptions = useMemo(() => {
    if (!statusTarget?.status) return [];
    const current = String(statusTarget.status).toUpperCase();
    return STATUS_TRANSITIONS[current] || [];
  }, [statusTarget]);

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const { data } = await getOrderStats();
      setStats(data.data);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load order stats");
    } finally {
      setLoadingStats(false);
    }
  };

  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      const params = {
        page: filters.page,
        limit: 20,
        sortBy: filters.sortBy,
      };
      if (filters.search) params.search = filters.search;
      if (filters.status) params.status = filters.status;
      if (filters.orderType) params.orderType = filters.orderType;
      if (filters.paymentStatus) params.paymentStatus = filters.paymentStatus;
      if (filters.date) params.date = filters.date;

      const { data } = await getOrders(params);
      setOrders(data.data || []);
      setMeta(data.meta || { page: filters.page, limit: 20, total: 0, totalPages: 1 });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load orders");
    } finally {
      setLoadingOrders(false);
    }
  };

  const loadOrderDependencies = async () => {
    setDependenciesLoading(true);
    try {
      const [{ data: foodsData }, { data: categoriesData }, { data: tablesData }] = await Promise.all([
        getAdminMenu({ limit: 200, available: true }),
        getAdminCategories(),
        getTables(),
      ]);

      setFoods(foodsData.data || []);
      setCategories(categoriesData.data || []);
      setTables(tablesData.data || []);
    } catch {
      toast.error("Unable to preload order dependencies");
    } finally {
      setDependenciesLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    loadOrderDependencies();
  }, []);

  useEffect(() => {
    loadOrders();
  }, [filters]);

  useEffect(() => {
    if (!socket) return;

    const refresh = () => {
      loadOrders();
      loadStats();
      loadOrderDependencies();
    };

    socket.on("order:new", refresh);
    socket.on("order:status", refresh);
    socket.on("order:payment", refresh);
    socket.on("order:cancelled", refresh);
    socket.on("table:statusChanged", refresh);

    return () => {
      socket.off("order:new", refresh);
      socket.off("order:status", refresh);
      socket.off("order:payment", refresh);
      socket.off("order:cancelled", refresh);
      socket.off("table:statusChanged", refresh);
    };
  }, [socket, filters]);

  const openDetails = async (order) => {
    setDetailsOpen(true);
    setDetailsLoading(true);
    setDetailsOrder(order);
    setPaidOrderReceipt(null);

    try {
      const { data } = await getOrderById(order._id);
      setDetailsOrder(data.data);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to load order details");
    } finally {
      setDetailsLoading(false);
    }
  };

  const openEdit = async (order) => {
    try {
      const { data } = await getOrderById(order._id);
      setEditOrder(data.data);
      setEditOpen(true);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to load order for editing");
    }
  };

  const openReceipt = async (order) => {
    try {
      const { data } = await getPaymentByOrderId(order._id);
      setPaidOrderReceipt(data.data);
      setDetailsOpen(true);
      setDetailsLoading(false);
      setDetailsOrder(data.data.order || order);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to load payment receipt");
    }
  };

  const submitCreate = async (payload) => {
    setSaving(true);
    try {
      const { paymentStatus, ...orderPayload } = payload;
      const { data } = await createOrder(orderPayload);
      let order = data.data;

      if (paymentStatus === "PAID") {
        await payOrder(order._id, {
          paymentMethod: orderPayload.paymentMethod || "CASH",
          paymentStatus: "PAID",
          gateway: orderPayload.paymentMethod || "CASH",
          transactionId: `PAY-${order.orderNumber}-${Date.now()}`,
          paidAt: new Date().toISOString(),
        });
        const refreshed = await getOrderById(order._id);
        order = refreshed.data?.data || order;
      }

      toast.success("Order created successfully");
      setCreateOpen(false);

      if (paymentStatus === "PAID") {
        await Promise.all([loadOrders(), loadStats(), loadOrderDependencies()]);
        return;
      }

      setCreatedOrder(order);
      setPaymentPromptOpen(true);
      await Promise.all([loadOrders(), loadStats(), loadOrderDependencies()]);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to create order");
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async (payload) => {
    if (!editOrder?._id) return;

    setSaving(true);
    try {
      await updateOrder(editOrder._id, payload);
      toast.success("Order updated successfully");
      setEditOpen(false);
      setEditOrder(null);
      await Promise.all([loadOrders(), loadStats(), loadOrderDependencies()]);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to update order");
    } finally {
      setSaving(false);
    }
  };

  const submitStatusUpdate = async () => {
    if (!statusTarget?._id || !statusValue) return;

    setSaving(true);
    try {
      await updateOrderStatus(statusTarget._id, statusValue);
      toast.success("Order status updated");
      setStatusTarget(null);
      setStatusValue("");
      await Promise.all([loadOrders(), loadStats(), loadOrderDependencies()]);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to update status");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget?._id || saving) return;

    setSaving(true);
    try {
      await deleteOrder(deleteTarget._id);
      toast.success("Order deleted successfully.");
      setDeleteTarget(null);
      await Promise.all([loadOrders(), loadStats(), loadOrderDependencies()]);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to delete order. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const closePaymentPrompt = () => {
    setPaymentPromptOpen(false);
    setCreatedOrder(null);
    setCashConfirmOpen(false);
  };

  const viewCreatedOrder = async () => {
    setPaymentPromptOpen(false);
    if (createdOrder) await openDetails(createdOrder);
  };

  const payCashNow = async () => {
    if (!createdOrder?._id) return;

    setCashConfirmLoading(true);
    try {
      await payOrder(createdOrder._id, {
        paymentMethod: createdOrder.paymentMethod || "CASH",
        paymentStatus: "PAID",
        gateway: "CASH",
        transactionId: `CASH-${createdOrder.orderNumber}-${Date.now()}`,
        paidAt: new Date().toISOString(),
      });
      toast.success("Cash payment marked as paid");
      closePaymentPrompt();
      await Promise.all([loadOrders(), loadStats(), loadOrderDependencies()]);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to update cash payment");
    } finally {
      setCashConfirmLoading(false);
    }
  };

  const processGatewayPayment = async () => {
    if (!createdOrder?._id) return;

    const paymentMethod = String(createdOrder.paymentMethod || "").toUpperCase();
    if (paymentMethod === "CASH") {
      setCashConfirmOpen(true);
      return;
    }

    setPaymentProcessing(true);
    try {
      const { data } = await createGatewayPayment({
        orderId: createdOrder._id,
        provider: "razorpay",
        paymentMethod,
      });
      const checkout = data.data;

      await loadRazorpayScript();

      const rzp = new window.Razorpay({
        key: checkout.keyId,
        amount: checkout.amount,
        currency: checkout.currency || "INR",
        name: "RestoSphere",
        description: `Order ${checkout.orderId}`,
        order_id: checkout.razorpayOrderId,
        handler: async (response) => {
          try {
            await verifyGatewayPayment({
              orderId: createdOrder._id,
              provider: "razorpay",
              paymentMethod,
              gatewayVerified: true,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            toast.success("Payment completed successfully");
            closePaymentPrompt();
            await Promise.all([loadOrders(), loadStats(), loadOrderDependencies()]);
          } catch (error) {
            toast.error(error?.response?.data?.message || "Payment verification failed");
          } finally {
            setPaymentProcessing(false);
          }
        },
        modal: {
          ondismiss: () => {
            toast.error("Payment cancelled.");
            setPaymentProcessing(false);
          },
        },
        prefill: {
          name: createdOrder.customer?.fullName || "Guest",
          email: createdOrder.customer?.email || "",
          contact: createdOrder.customer?.phone || "",
        },
        notes: { orderId: createdOrder.orderNumber },
        theme: { color: "#0f766e" },
      });

      rzp.on("payment.failed", () => {
        toast.error("Payment failed. Please try again.");
        setPaymentProcessing(false);
      });

      rzp.open();
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Unable to start payment");
      setPaymentProcessing(false);
    }
  };

  const goToPage = (page) => {
    if (page < 1 || page > (meta.totalPages || 1)) return;
    setFilters((current) => ({ ...current, page }));
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">Order Management</h2>
        <p className="mt-1 text-sm text-slate-500">Manage restaurant orders, payments, tables and order status in real time.</p>
      </div>

      <OrderStats stats={stats} loading={loadingStats} />

      <OrderToolbar
        filters={filters}
        onChange={setFilters}
        onCreate={() => {
          loadOrderDependencies();
          setCreateOpen(true);
        }}
      />

      <OrderTable
        orders={orders}
        loading={loadingOrders}
        onEdit={openEdit}
        onDelete={(order) => setDeleteTarget(order)}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-sm shadow-sm">
        <p>
          Showing {(meta.page - 1) * meta.limit + (orders.length ? 1 : 0)}-{(meta.page - 1) * meta.limit + orders.length} of {meta.total} orders
        </p>
        <div className="flex items-center gap-2">
          <button onClick={() => goToPage(meta.page - 1)} disabled={meta.page <= 1} className="rounded border border-slate-300 px-2 py-1 disabled:opacity-60">Previous</button>
          {Array.from({ length: Math.min(meta.totalPages || 1, 5) }).map((_, idx) => {
            const page = idx + 1;
            return (
              <button key={page} onClick={() => goToPage(page)} className={`rounded border px-2 py-1 ${meta.page === page ? "border-brand-700 bg-brand-700 text-white" : "border-slate-300"}`}>
                {page}
              </button>
            );
          })}
          <button onClick={() => goToPage(meta.page + 1)} disabled={meta.page >= (meta.totalPages || 1)} className="rounded border border-slate-300 px-2 py-1 disabled:opacity-60">Next</button>
        </div>
      </div>

      <CreateOrderModal
        open={createOpen}
        loading={saving}
        menuItems={foods}
        categories={categories}
        tables={tables}
        dependenciesLoading={dependenciesLoading}
        onClose={() => setCreateOpen(false)}
        onSubmit={submitCreate}
      />

      <EditOrderModal
        open={editOpen}
        loading={saving}
        menuItems={foods}
        categories={categories}
        tables={tables}
        dependenciesLoading={dependenciesLoading}
        initialData={editOrder}
        onClose={() => {
          setEditOpen(false);
          setEditOrder(null);
        }}
        onSubmit={submitEdit}
      />

      <OrderDetailsDrawer
        open={detailsOpen}
        order={paidOrderReceipt?.order || detailsOrder}
        loading={detailsLoading}
        onClose={() => {
          setDetailsOpen(false);
          setDetailsOrder(null);
          setPaidOrderReceipt(null);
        }}
        onViewReceipt={openReceipt}
        onPrintReceipt={openReceipt}
      />

      <CashPaymentConfirmationModal
        open={cashConfirmOpen}
        amount={createdOrder ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(createdOrder.total || 0)) : "₹0"}
        loading={cashConfirmLoading}
        onClose={() => setCashConfirmOpen(false)}
        onConfirm={payCashNow}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Order?"
        message={`Are you sure you want to delete order #${deleteTarget?.orderNumber || deleteTarget?._id}?\nThis action cannot be undone.`}
        onCancel={() => {
          if (saving) return;
          setDeleteTarget(null);
        }}
        onConfirm={confirmDelete}
        loading={saving}
      />

      {statusTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">Update Order Status</h3>
            <p className="mt-1 text-sm text-slate-500">{statusTarget.orderNumber}</p>

            {!selectedStatusOptions.length ? (
              <p className="mt-3 text-sm text-slate-600">No further status transition is allowed for this order.</p>
            ) : (
              <select className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" value={statusValue} onChange={(e) => setStatusValue(e.target.value)}>
                <option value="">Select next status</option>
                {selectedStatusOptions.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            )}

            <div className="mt-4 flex justify-end gap-3">
              <button onClick={() => setStatusTarget(null)} className="rounded-xl border border-slate-300 px-4 py-2 text-sm">Cancel</button>
              <button onClick={submitStatusUpdate} disabled={saving || !statusValue} className="rounded-xl bg-brand-700 px-4 py-2 text-sm text-white disabled:opacity-60">Update</button>
            </div>
          </div>
        </div>
      )}

      <OrderPaymentPromptModal
        open={paymentPromptOpen}
        order={createdOrder}
        loading={paymentProcessing}
        onClose={closePaymentPrompt}
        onPayNow={processGatewayPayment}
        onPayLater={closePaymentPrompt}
        onViewOrder={viewCreatedOrder}
      />
    </div>
  );
};

export default OrderManagement;
