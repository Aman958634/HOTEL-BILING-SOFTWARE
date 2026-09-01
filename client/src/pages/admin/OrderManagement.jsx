import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
import RequestState from "../../components/common/RequestState";
import TablePagination from "../../components/common/TablePagination";
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

const formatINR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

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
  const location = useLocation();
  const navigate = useNavigate();

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
  const [ordersError, setOrdersError] = useState("");
  const [dependenciesLoading, setDependenciesLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [foods, setFoods] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tables, setTables] = useState([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createInitialTable, setCreateInitialTable] = useState(null);
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
  const filtersRef = useRef(filters);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    const state = location.state;
    if (!state) return;

    if (state.tableId) {
      setCreateInitialTable(state.tableId);
      setCreateOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    } else if (state.orderId) {
      setEditOpen(true);
      getOrderById(state.orderId)
        .then((res) => setEditOrder(res.data.data))
        .catch(() => toast.error("Unable to load order"));
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, navigate, location.pathname]);

  const selectedStatusOptions = useMemo(() => {
    if (!statusTarget?.status) return [];
    const current = String(statusTarget.status).toUpperCase();
    return STATUS_TRANSITIONS[current] || [];
  }, [statusTarget]);

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const { data } = await getOrderStats();
      setStats(data.data);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load order stats");
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const loadOrders = useCallback(async (currentFilters = filtersRef.current) => {
    setLoadingOrders(true);
    setOrdersError("");
    try {
      const params = {
        page: currentFilters.page,
        limit: 20,
        sortBy: currentFilters.sortBy,
      };
      if (currentFilters.search) params.search = currentFilters.search;
      if (currentFilters.status) params.status = currentFilters.status;
      if (currentFilters.orderType) params.orderType = currentFilters.orderType;
      if (currentFilters.paymentStatus) params.paymentStatus = currentFilters.paymentStatus;
      if (currentFilters.date) params.date = currentFilters.date;

      const { data } = await getOrders(params);
      setOrders(data.data || []);
      setMeta(data.meta || { page: currentFilters.page, limit: 20, total: 0, totalPages: 1 });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load orders");
      setOrdersError(error?.response?.data?.message || "Failed to load orders");
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  const loadOrderDependencies = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    loadStats();
    loadOrderDependencies();
  }, [loadStats, loadOrderDependencies]);

  useEffect(() => {
    loadOrders(filters);
  }, [filters, loadOrders]);

  useEffect(() => {
    if (!socket) return;

    let timeoutId = null;
    const scheduleRefresh = () => {
      if (timeoutId) return;
      timeoutId = setTimeout(() => {
        timeoutId = null;
        loadOrders();
        loadStats();
      }, 250);
    };

    socket.on("order:new", scheduleRefresh);
    socket.on("order:status", scheduleRefresh);
    socket.on("order:paymentUpdated", scheduleRefresh);
    socket.on("order:cancelled", scheduleRefresh);
    socket.on("table:statusChanged", scheduleRefresh);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      socket.off("order:new", scheduleRefresh);
      socket.off("order:status", scheduleRefresh);
      socket.off("order:paymentUpdated", scheduleRefresh);
      socket.off("order:cancelled", scheduleRefresh);
      socket.off("table:statusChanged", scheduleRefresh);
    };
  }, [socket, loadOrders, loadStats]);

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

  const openEdit = useCallback(async (order) => {
    try {
      const { data } = await getOrderById(order._id);
      setEditOrder(data.data);
      setEditOpen(true);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to load order for editing");
    }
  }, []);

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
      const isCashSettlement = paymentStatus === "PAID" && String(orderPayload.paymentMethod || "CASH").toUpperCase() === "CASH";

      if (isCashSettlement) {
        await payOrder(order._id, {
          paymentMethod: "CASH",
          paymentStatus: "PAID",
          gateway: "CASH",
          transactionId: `CASH-${order.orderNumber}-${Date.now()}`,
          paidAt: new Date().toISOString(),
        });
        const refreshed = await getOrderById(order._id);
        order = refreshed.data?.data || order;
      }

      toast.success("Order created successfully");
      setCreateOpen(false);

      if (isCashSettlement) {
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

  const goToPage = useCallback((page) => {
    if (page < 1 || page > (meta.totalPages || 1)) return;
    setFilters((current) => ({ ...current, page }));
  }, [meta.totalPages]);

  const openCreate = useCallback(() => {
    loadOrderDependencies();
    setCreateOpen(true);
  }, [loadOrderDependencies]);

  const requestDelete = useCallback((order) => setDeleteTarget(order), []);

  return (
    <div className="ui-page">
      <div className="ui-page-header">
        <div>
          <h2 className="ui-page-title">Order Management</h2>
          <p className="ui-page-description">Manage restaurant orders, payments, tables and order status in real time.</p>
        </div>
      </div>

      <OrderStats stats={stats} loading={loadingStats} />

      <OrderToolbar
        filters={filters}
        onChange={setFilters}
        onCreate={openCreate}
      />

      <OrderTable
        orders={orders}
        loading={loadingOrders}
        error={ordersError}
        hasFilters={Boolean(filters.search || filters.status || filters.orderType || filters.paymentStatus || filters.date)}
        onEdit={openEdit}
        onDelete={requestDelete}
      />
      {ordersError ? <RequestState message={ordersError} onRetry={loadOrders} /> : null}

      <TablePagination meta={meta} onPageChange={goToPage} itemLabel="orders" className="ui-card" />

      <CreateOrderModal
        open={createOpen}
        loading={saving}
        menuItems={foods}
        categories={categories}
        tables={tables}
        dependenciesLoading={dependenciesLoading}
        initialData={createInitialTable ? { table: createInitialTable } : null}
        onClose={() => {
          setCreateOpen(false);
          setCreateInitialTable(null);
        }}
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
        amount={createdOrder ? formatINR.format(Number(createdOrder.total || 0)) : "₹0"}
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
          <div className="w-full max-w-md mx-4 rounded-2xl bg-white p-5 shadow-2xl">
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
