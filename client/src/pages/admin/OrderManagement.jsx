import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { FiPlus } from "react-icons/fi";
import toast from "react-hot-toast";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import CashPaymentConfirmationModal from "../../components/admin/orders/CashPaymentConfirmationModal";
import CreateOrderModal from "../../components/admin/orders/CreateOrderModal";
import EditOrderModal from "../../components/admin/orders/EditOrderModal";
import HotelUpiPaymentModal from "../../components/payments/HotelUpiPaymentModal";
import PaymentReceipt from "../../components/payments/PaymentReceipt";
import OrderDetailsDrawer from "../../components/admin/orders/OrderDetailsDrawer";
import KitchenKotReceipt from "../../components/admin/orders/KitchenKotReceipt";
import OrderPaymentPromptModal from "../../components/admin/orders/OrderPaymentPromptModal";
import RetryPaymentModal from "../../components/admin/orders/RetryPaymentModal";
import OrderStats from "../../components/admin/orders/OrderStats";
import OrderTable from "../../components/admin/orders/OrderTable";
import OrderToolbar from "../../components/admin/orders/OrderToolbar";
import RequestState from "../../components/common/RequestState";
import TablePagination from "../../components/common/TablePagination";
import { useSocket } from "../../context/SocketContext";
import { getAllAdminCategoriesForOrder } from "../../services/categoryService";
import { getAllAdminMenu } from "../../services/menuService";
import {
  createOrder,
  deleteOrder,
  getOrderById,
  getOrderKot,
  getOrderStats,
  getOrders,
  payOrder,
  updateOrder,
  updateOrderStatus,
} from "../../services/orderService";
import { createCashfreePayment, createGatewayPayment, getOrderPaymentSummary, getPaymentById, getPaymentReceipt, verifyGatewayPayment } from "../../services/paymentService";
import { generateHotelPaymentQr, getHotelPaymentSettings, verifyHotelPayment } from "../../services/hotelPaymentService";
import { openCashfreeCheckout } from "../../utils/cashfreeCheckout";
import { canViewPaymentReceipt } from "../../utils/paymentUtils";
import { getAllTablesForOrder } from "../../services/tableService";
import { getRestaurantSettings } from "../../services/restaurantService";
import { clearOrderDraft, getOrderDraftScope } from "../../utils/orderDraft";
import { applyAuthoritativeCashPayment } from "../../utils/cashPaymentConfirmation";
import { useKeyboardShortcutScope } from "../../context/useKeyboardShortcutScope";
import { getOfflineOrderScope, savePendingOfflineOrder } from "../../utils/offlineOrderQueue";
import { listPendingOfflineOrders } from "../../utils/offlineOrderQueue";
import { syncPendingOfflineOrders } from "../../services/offlineOrderSync";
import {
  cacheOrderList,
  createOrderListCacheKey,
  createOrderListScope,
  getCachedOrderList,
  getSharedOrderListRequest,
} from "../../utils/orderListCache";

const ORDER_DEPENDENCY_TIMEOUT_MS = 30000;

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
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
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

const ReceiptPaymentPicker = ({ open, order, payments, loadingPaymentId, onClose, onSelect }) => {
  if (!open) return null;

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="receipt-payment-picker-title" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-5">
      <div className="flex items-start justify-between gap-3"><div><h3 id="receipt-payment-picker-title" className="text-lg font-bold text-slate-900">Select payment receipt</h3><p className="mt-1 text-sm text-slate-600">Order #{order?.orderNumber || ""} has multiple verified payments.</p></div><button type="button" onClick={onClose} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700">Close</button></div>
      <div className="mt-4 space-y-2">{payments.map((payment) => {
        const paymentId = String(payment._id || payment.paymentId || "");
        const paidAt = payment.paidAt || payment.createdAt;
        return <button key={paymentId} type="button" disabled={Boolean(loadingPaymentId)} onClick={() => onSelect(payment)} className="w-full rounded-xl border border-slate-200 p-3 text-left transition hover:border-brand-300 hover:bg-brand-50 disabled:cursor-wait disabled:opacity-60">
          <span className="flex flex-wrap items-start justify-between gap-2"><span className="font-semibold text-slate-900">{payment.paymentId || "Verified payment"}</span><span className="font-bold text-slate-900">{formatINR.format(Number(payment.totalAmount ?? payment.amount ?? 0))}</span></span>
          <span className="mt-1 block text-xs text-slate-600">{String(payment.paymentMethod || "Payment").replaceAll("_", " ")} · {paidAt ? new Date(paidAt).toLocaleString("en-IN") : "Verified payment"}</span>
        </button>;
      })}</div>
    </section>
  </div>;
};
const OrderManagement = () => {
  const socket = useSocket();
  const { user, activeOutletId, authorizedOutlets, outletStatus } = useSelector((state) => state.auth);
  const isChef = user?.role === "chef";
  const location = useLocation();
  const navigate = useNavigate();

  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({
    search: "",
    status: "",
    orderType: "",
    paymentStatus: "",
    date: "",
    sortBy: "newest",
    page: 1,
  });

  const orderCacheScope = useMemo(
    () => outletStatus === "ready" ? createOrderListScope({ user, activeOutletId, authorizedOutlets }) : "",
    [activeOutletId, authorizedOutlets, outletStatus, user]
  );
  const orderCacheKey = useMemo(() => createOrderListCacheKey(orderCacheScope, filters), [filters, orderCacheScope]);
  const initialOrderCache = getCachedOrderList(orderCacheKey);
  const [orders, setOrders] = useState(() => initialOrderCache?.orders || []);
  const [meta, setMeta] = useState(() => initialOrderCache?.meta || { page: 1, limit: 20, total: 0, totalPages: 1 });
  const [ordersCacheKey, setOrdersCacheKey] = useState(() => initialOrderCache ? orderCacheKey : "");

  const [loadingStats, setLoadingStats] = useState(true);
  const [initialLoadingOrders, setInitialLoadingOrders] = useState(() => Boolean(orderCacheKey && !initialOrderCache));
  const [backgroundRefreshingOrders, setBackgroundRefreshingOrders] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [ordersErrorCacheKey, setOrdersErrorCacheKey] = useState("");
  const [dependenciesLoading, setDependenciesLoading] = useState(false);
  const [dependenciesReady, setDependenciesReady] = useState(false);
  const [dependenciesError, setDependenciesError] = useState("");
  const [tablesLoading, setTablesLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [foods, setFoods] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tables, setTables] = useState([]);
  const [restaurantGstRate, setRestaurantGstRate] = useState(0);
  const [restaurantDefaultDiscountPercent, setRestaurantDefaultDiscountPercent] = useState(0);
  const [simplePrintedKotWorkflow, setSimplePrintedKotWorkflow] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createInitialTable, setCreateInitialTable] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editOrder, setEditOrder] = useState(null);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsOrder, setDetailsOrder] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState(null);
  const [receiptPickerOpen, setReceiptPickerOpen] = useState(false);
  const [receiptCandidates, setReceiptCandidates] = useState([]);
  const [receiptDownloadLoading, setReceiptDownloadLoading] = useState(false);
  const [receiptLoadingPaymentId, setReceiptLoadingPaymentId] = useState("");
  const [kitchenKot, setKitchenKot] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [statusValue, setStatusValue] = useState("");

  const [createdOrder, setCreatedOrder] = useState(null);
  const [paymentPromptOpen, setPaymentPromptOpen] = useState(false);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [cashConfirmOpen, setCashConfirmOpen] = useState(false);
  const [cashConfirmLoading, setCashConfirmLoading] = useState(false);
  const [retryTarget, setRetryTarget] = useState(null);
  const [retrySettlement, setRetrySettlement] = useState(null);
  const [retryMethod, setRetryMethod] = useState("CASH");
  const [retryProcessing, setRetryProcessing] = useState(false);
  const [retryHotelUpiCapability, setRetryHotelUpiCapability] = useState({ canCollect: false, reason: "Configure Hotel UPI in Settings." });
  const [createHotelUpiCapability, setCreateHotelUpiCapability] = useState({ canCollect: false, reason: "Checking Hotel UPI availability..." });
  const [retryHotelUpiOnly, setRetryHotelUpiOnly] = useState(false);
  const [hotelPaymentOrder, setHotelPaymentOrder] = useState(null);
  const [hotelPaymentData, setHotelPaymentData] = useState(null);
  const [hotelPaymentActionLoading, setHotelPaymentActionLoading] = useState(false);
  const filtersRef = useRef(filters);
  const ordersCacheKeyRef = useRef(initialOrderCache ? orderCacheKey : "");
  const activeOrderCacheKeyRef = useRef(orderCacheKey);
  const orderRequestRef = useRef(0);
  const tableRequestRef = useRef(0);
  const dependencyRequestRef = useRef(0);
  const dependencyInFlightRef = useRef(null);
  const createSubmittingRef = useRef(false);
  const cashConfirmSubmittingRef = useRef(false);
  const cashSettlementIdempotencyKeyRef = useRef("");
  const receiptLookupRequestRef = useRef(false);
  const receiptPaymentRequestRef = useRef("");
  const receiptDownloadRequestRef = useRef(false);
  const receiptPrintRequestRef = useRef(false);
  const [createSubmitError, setCreateSubmitError] = useState("");
  const [pendingOfflineCount, setPendingOfflineCount] = useState(0);

  const canCollectPayments = ["admin", "restaurant_admin", "hotel_admin", "manager", "cashier"].includes(String(user?.role || "").toLowerCase())
    || String(user?.accessLevel || "").toUpperCase() === "FULL_ACCESS"
    || user?.customPermissions?.includes("payments.collect")
    || user?.permissions?.includes("payments.collect");

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  activeOrderCacheKeyRef.current = orderCacheKey;

  useEffect(() => {
    if (!createOpen) return undefined;
    let active = true;
    getHotelPaymentSettings()
      .then(({ data }) => data?.data?.capability
        ? { canCollect: data.data.capability.canCollect === true, reason: data.data.capability.reason || "Hotel UPI is unavailable for this deployment." }
        : { canCollect: false, reason: "The backend release does not report Hotel UPI capability." })
      .catch((error) => ({ canCollect: false, reason: error?.response?.data?.message || "Unable to confirm Hotel UPI configuration." }))
      .then((capability) => { if (active) setCreateHotelUpiCapability(capability); });
    return () => { active = false; };
  }, [createOpen]);

  useEffect(() => {
    const state = location.state;
    if (!state) return;

    if (state.keyboardShortcut === "new-order") {
      setCreateSubmitError("");
      setCreateOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    } else if (state.tableId) {
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

  const loadOrders = useCallback(async (currentFilters = filtersRef.current, requestCacheKey = orderCacheKey) => {
    if (!requestCacheKey) {
      setInitialLoadingOrders(false);
      setBackgroundRefreshingOrders(false);
      return;
    }

    const requestId = orderRequestRef.current + 1;
    orderRequestRef.current = requestId;
    const cached = getCachedOrderList(requestCacheKey);
    const hasCurrentData = ordersCacheKeyRef.current === requestCacheKey;
    if (!hasCurrentData && cached) {
      setOrders(cached.orders);
      setMeta(cached.meta);
      setOrdersCacheKey(requestCacheKey);
      ordersCacheKeyRef.current = requestCacheKey;
    }
    const hasUsableData = hasCurrentData || Boolean(cached);
    setInitialLoadingOrders(!hasUsableData);
    setBackgroundRefreshingOrders(hasUsableData);
    setOrdersError("");
    setOrdersErrorCacheKey("");
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

      const { data } = await getSharedOrderListRequest(requestCacheKey, () => getOrders(params));
      if (requestId !== orderRequestRef.current || activeOrderCacheKeyRef.current !== requestCacheKey) return;
      const nextOrders = data.data || [];
      const nextMeta = data.meta || { page: currentFilters.page, limit: 20, total: 0, totalPages: 1 };
      cacheOrderList(requestCacheKey, nextOrders, nextMeta);
      setOrders(nextOrders);
      setMeta(nextMeta);
      setOrdersCacheKey(requestCacheKey);
      ordersCacheKeyRef.current = requestCacheKey;
    } catch (error) {
      if (error?.code === "ERR_CANCELED" || requestId !== orderRequestRef.current || activeOrderCacheKeyRef.current !== requestCacheKey) return;
      toast.error(error?.response?.data?.message || "Failed to load orders");
      setOrdersError(error?.response?.data?.message || "Failed to load orders");
      setOrdersErrorCacheKey(requestCacheKey);
    } finally {
      if (requestId === orderRequestRef.current && activeOrderCacheKeyRef.current === requestCacheKey) {
        setInitialLoadingOrders(false);
        setBackgroundRefreshingOrders(false);
      }
    }
  }, [orderCacheKey]);

  const loadOrderDependencies = useCallback(async () => {
    const requestScope = String(activeOutletId || "");
    const currentRequest = dependencyInFlightRef.current;
    if (currentRequest?.scope === requestScope) return currentRequest.promise;

    const requestId = dependencyRequestRef.current + 1;
    dependencyRequestRef.current = requestId;
    setDependenciesLoading(true);
    setDependenciesReady(false);
    setDependenciesError("");

    const promise = (async () => {
      try {
        let timeoutId;
        let dependencies;
        try {
          dependencies = await Promise.race([
            Promise.all([
              getAllAdminMenu({ available: true }),
              getAllAdminCategoriesForOrder(),
              getRestaurantSettings(),
            ]),
            new Promise((_, reject) => {
              timeoutId = window.setTimeout(() => reject(new Error("Menu loading timed out. Please retry.")), ORDER_DEPENDENCY_TIMEOUT_MS);
            }),
          ]);
        } finally {
          window.clearTimeout(timeoutId);
        }
        const [menuItems, orderCategories, { data: restaurantData }] = dependencies;
        if (requestId !== dependencyRequestRef.current) return false;

        setFoods(menuItems);
        setCategories(orderCategories);
        const configuredRate = Number(restaurantData?.data?.gstRate);
        setRestaurantGstRate(Number.isFinite(configuredRate) && configuredRate >= 0 && configuredRate <= 100 ? configuredRate : 0);
        const configuredDiscount = Number(restaurantData?.data?.defaultDiscountPercent);
        setRestaurantDefaultDiscountPercent(Number.isFinite(configuredDiscount) && configuredDiscount >= 0 && configuredDiscount <= 100 ? configuredDiscount : 0);
        setSimplePrintedKotWorkflow(Boolean(restaurantData?.data?.simpleOrderWorkflowEnabled && restaurantData?.data?.kitchenDisplayEnabled === false));
        setDependenciesReady(true);
        return true;
      } catch (error) {
        if (requestId !== dependencyRequestRef.current) return false;
        setDependenciesError(error?.response?.data?.message || error?.message || "Unable to load menu items. Please retry.");
        return false;
      } finally {
        if (requestId === dependencyRequestRef.current) setDependenciesLoading(false);
        if (dependencyInFlightRef.current?.requestId === requestId) dependencyInFlightRef.current = null;
      }
    })();

    dependencyInFlightRef.current = { requestId, scope: requestScope, promise };
    return promise;
  }, [activeOutletId]);

  useEffect(() => {
    let active = true;
    getRestaurantSettings()
      .then(({ data }) => {
        if (active) setSimplePrintedKotWorkflow(Boolean(data?.data?.simpleOrderWorkflowEnabled && data?.data?.kitchenDisplayEnabled === false));
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const loadOrderTables = useCallback(async () => {
    const requestId = tableRequestRef.current + 1;
    tableRequestRef.current = requestId;
    setTablesLoading(true);
    try {
      const nextTables = await getAllTablesForOrder();
      if (requestId === tableRequestRef.current) setTables(nextTables);
    } catch (error) {
      if (requestId === tableRequestRef.current) {
        setTables([]);
        toast.error(error?.response?.data?.message || "Unable to load tables for this order");
      }
    } finally {
      if (requestId === tableRequestRef.current) setTablesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isChef) loadStats();
  }, [isChef, loadStats]);

  // Menu/category payloads are only needed by the create-order dialog. Deferring
  // them keeps ordinary Orders navigation from parsing and rendering a large
  // dependency set alongside the list and live summary cards.
  useEffect(() => {
    if ((!createOpen && !editOpen) || isChef) return;
    void loadOrderDependencies();
  }, [activeOutletId, createOpen, editOpen, isChef, loadOrderDependencies]);

  // Refresh at the interaction boundary so recently-created tables are never
  // hidden behind a dependency cache or the paginated list's first page.
  useEffect(() => {
    if (!createOpen) return;
    void loadOrderTables();
  }, [createOpen, loadOrderTables, activeOutletId]);

  useEffect(() => {
    loadOrders(filters, orderCacheKey);
  }, [filters, loadOrders, orderCacheKey]);

  useEffect(() => () => {
    orderRequestRef.current += 1;
  }, []);

  useEffect(() => {
    if (!socket) return;

    let timeoutId = null;
    const scheduleRefresh = () => {
      if (timeoutId) return;
      timeoutId = setTimeout(() => {
        timeoutId = null;
        loadOrders();
        loadStats();
        if (createOpen) void loadOrderTables();
      }, 250);
    };

    socket.on("order:new", scheduleRefresh);
    socket.on("order:status", scheduleRefresh);
    socket.on("order:paymentUpdated", scheduleRefresh);
    socket.on("payment:updated", scheduleRefresh);
    socket.on("order:cancelled", scheduleRefresh);
    socket.on("table:statusChanged", scheduleRefresh);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      socket.off("order:new", scheduleRefresh);
      socket.off("order:status", scheduleRefresh);
      socket.off("order:paymentUpdated", scheduleRefresh);
      socket.off("payment:updated", scheduleRefresh);
      socket.off("order:cancelled", scheduleRefresh);
      socket.off("table:statusChanged", scheduleRefresh);
    };
  }, [socket, createOpen, loadOrderTables, loadOrders, loadStats]);

  const openDetails = useCallback(async (order) => {
    setDetailsOpen(true);
    setDetailsLoading(true);
    setDetailsOrder(order);
    setSelectedOrder(order);

    try {
      const { data } = await getOrderById(order._id);
      setDetailsOrder(data.data);
      setSelectedOrder(data.data);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to load order details");
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  const openEdit = useCallback(async (order) => {
    try {
      const { data } = await getOrderById(order._id);
      setEditOrder(data.data);
      setEditOpen(true);
      void loadOrderTables();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to load order for editing");
    }
  }, [loadOrderTables]);

  const openReceiptPayment = useCallback(async (payment) => {
    const paymentId = String(payment?._id || payment?.paymentId || "");
    if (!paymentId || receiptPaymentRequestRef.current) return;
    receiptPaymentRequestRef.current = paymentId;
    setReceiptLoadingPaymentId(paymentId);
    try {
      const { data } = await getPaymentById(paymentId);
      const verifiedPayment = data.data;
      if (!canViewPaymentReceipt(verifiedPayment)) {
        toast.error("No payment receipt available for this order.");
        return;
      }
      setReceiptPayment(verifiedPayment);
      setReceiptPickerOpen(false);
      setDetailsOpen(false);
      setDetailsOrder(null);
      setReceiptOpen(true);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to load payment receipt");
    } finally {
      if (receiptPaymentRequestRef.current === paymentId) receiptPaymentRequestRef.current = "";
      setReceiptLoadingPaymentId("");
    }
  }, []);

  const openReceipt = useCallback(async (order) => {
    if (isChef || !order?._id || receiptOpen || receiptPickerOpen || receiptLookupRequestRef.current || receiptPaymentRequestRef.current) return;
    receiptLookupRequestRef.current = true;
    try {
      const { data } = await getOrderPaymentSummary(order._id);
      const verifiedPayments = (data.data?.payments || []).filter(canViewPaymentReceipt);
      if (!verifiedPayments.length) {
        toast.error("No payment receipt available for this order.");
        return;
      }
      if (verifiedPayments.length > 1) {
        setReceiptCandidates(verifiedPayments);
        setReceiptPickerOpen(true);
        return;
      }
      await openReceiptPayment(verifiedPayments[0]);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to load payment receipt");
    } finally {
      receiptLookupRequestRef.current = false;
    }
  }, [isChef, openReceiptPayment, receiptOpen, receiptPickerOpen]);

  const downloadReceipt = useCallback(async () => {
    if (!receiptPayment || receiptDownloadRequestRef.current) return;
    receiptDownloadRequestRef.current = true;
    setReceiptDownloadLoading(true);
    try {
      const { data } = await getPaymentReceipt(receiptPayment._id || receiptPayment.paymentId);
      const url = URL.createObjectURL(data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `receipt-${receiptPayment.paymentId}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("Receipt downloaded");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to download receipt");
    } finally {
      receiptDownloadRequestRef.current = false;
      setReceiptDownloadLoading(false);
    }
  }, [receiptPayment]);

  const printReceipt = useCallback(() => {
    if (receiptPrintRequestRef.current || !document.getElementById("payment-receipt-print")) return;
    receiptPrintRequestRef.current = true;
    const clearPrintMode = () => {
      document.body.classList.remove("payment-receipt-printing");
      receiptPrintRequestRef.current = false;
    };
    document.body.classList.add("payment-receipt-printing");
    window.addEventListener("afterprint", clearPrintMode, { once: true });
    try {
      window.print();
    } catch (_error) {
      clearPrintMode();
      toast.error("Unable to open the print dialog");
    }
  }, []);

  const openRetryPayment = useCallback(async (order) => {
    if (!canCollectPayments || !order?._id) return;
    try {
      const [summaryResponse, hotelPaymentCapability] = await Promise.all([
        getOrderPaymentSummary(order._id),
        getHotelPaymentSettings()
          .then(({ data }) => data?.data?.capability
            ? { canCollect: data.data.capability.canCollect === true, reason: data.data.capability.reason || "Hotel UPI is unavailable for this deployment." }
            : { canCollect: false, reason: "The backend release does not report Hotel UPI capability. Deploy the compatible backend first." })
          .catch((error) => ({ canCollect: false, reason: error?.response?.data?.message || "Unable to confirm Hotel UPI configuration." })),
      ]);
      const { data } = summaryResponse;
      const summary = data.data?.settlement || {};
      if (summary.fullyPaid || Number(summary.amountDue || 0) <= 0) {
        toast.success("This order is already paid");
        await loadOrders();
        return;
      }
      setRetryTarget({ ...order, ...(data.data?.order || {}) });
      setRetrySettlement(summary);
      setRetryHotelUpiCapability(hotelPaymentCapability);
      const hotelUpiAttemptPending = String(order.paymentStatus || data.data?.order?.paymentStatus || "").toUpperCase() === "AWAITING_VERIFICATION";
      setRetryHotelUpiOnly(hotelUpiAttemptPending);
      setRetryMethod(hotelUpiAttemptPending ? "HOTEL_UPI" : "CASH");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to load the outstanding payment");
    }
  }, [canCollectPayments, loadOrders]);

  const closeRetryPayment = () => {
    if (retryProcessing) return;
    setRetryTarget(null);
    setRetrySettlement(null);
  };

  const requestHotelUpiQr = async (order) => {
    setHotelPaymentActionLoading(true);
    try {
      const { data } = await generateHotelPaymentQr({ orderId: order._id });
      const qrData = data?.data || null;
      if (!qrData?.qrCode || !qrData?.payment) throw new Error("The server did not return a Hotel UPI payment attempt.");
      setHotelPaymentData(qrData);
      await Promise.all([loadOrders(), loadStats()]);
      return qrData;
    } finally {
      setHotelPaymentActionLoading(false);
    }
  };

  const processHotelUpiPayment = async () => {
    if (!retryTarget?._id || retryProcessing || !retryHotelUpiCapability.canCollect) return;
    setRetryProcessing(true);
    try {
      await requestHotelUpiQr(retryTarget);
      setHotelPaymentOrder(retryTarget);
      setRetryTarget(null);
      setRetrySettlement(null);
      toast.success("Hotel UPI QR generated. Payment remains pending independent verification.");
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Unable to generate Hotel UPI QR");
    } finally {
      setRetryProcessing(false);
    }
  };

  const refreshHotelUpiStatus = async ({ silent = false } = {}) => {
    const paymentId = hotelPaymentData?.payment?._id || hotelPaymentData?.payment?.paymentId;
    if (!paymentId || hotelPaymentActionLoading) return;
    setHotelPaymentActionLoading(true);
    try {
      const { data } = await getPaymentById(paymentId);
      const paymentRecord = data?.data || {};
      setHotelPaymentData((current) => ({ ...current, payment: paymentRecord, paymentStatus: paymentRecord.paymentStatus || current?.paymentStatus }));
      await Promise.all([loadOrders(), loadStats()]);
      if (String(paymentRecord.paymentStatus || "").toUpperCase() === "PAID") {
        if (!silent) toast.success("Hotel payment was independently verified. Order balances and reports are refreshed.");
      } else if (paymentRecord.metadata?.rejectionNote) {
        if (!silent) toast.error(`Hotel UPI attempt rejected: ${paymentRecord.metadata.rejectionNote}. Generate a new QR to retry.`);
      } else if (!silent) {
        toast("No independent bank-credit verification has been recorded yet.");
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to refresh Hotel UPI payment status");
    } finally {
      setHotelPaymentActionLoading(false);
    }
  };

  const openKitchenKot = useCallback(async (order) => {
    if (!order?._id) return;
    try {
      const { data } = await getOrderKot(order._id);
      setKitchenKot(data.data);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to load Kitchen KOT");
    }
  }, []);

  const confirmHotelUpiPaymentReceived = async (transactionId) => {
    const paymentId = hotelPaymentData?.payment?._id || hotelPaymentData?.payment?.paymentId;
    if (!paymentId || hotelPaymentActionLoading) return false;
    setHotelPaymentActionLoading(true);
    try {
      const { data } = await verifyHotelPayment({ paymentId, transactionId: transactionId || undefined });
      const paymentRecord = data?.data?.payment || {};
      setHotelPaymentData((current) => ({ ...current, payment: paymentRecord, paymentStatus: paymentRecord.paymentStatus || "PAID" }));
      await Promise.all([loadOrders(), loadStats()]);
      toast.success("Payment successful");
      return true;
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to confirm payment received");
      return false;
    } finally {
      setHotelPaymentActionLoading(false);
    }
  };

  const downloadHotelUpiReceipt = async () => {
    const paymentId = hotelPaymentData?.payment?._id || hotelPaymentData?.payment?.paymentId;
    if (!paymentId) return;
    try {
      const { data } = await getPaymentReceipt(paymentId);
      const url = URL.createObjectURL(data);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `receipt-${paymentId}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success("Hotel UPI receipt downloaded");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to download Hotel UPI receipt");
    }
  };

  const closeHotelUpiPayment = () => {
    if (hotelPaymentActionLoading) return;
    setHotelPaymentOrder(null);
    setHotelPaymentData(null);
  };

  const processRetryPayment = async () => {
    if (!retryTarget?._id || retryProcessing) return;
    const amountDue = Number(retrySettlement?.amountDue || 0);
    if (amountDue <= 0) return;
    const idempotencyKey = `retry-payment:${retryTarget._id}:${crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`}`;
    setRetryProcessing(true);
    try {
      if (retryMethod === "CASH") {
        await payOrder(retryTarget._id, {
          amount: amountDue,
          paymentMethod: "CASH",
          paymentStatus: "PAID",
          gateway: "CASH",
          transactionId: `CASH-${retryTarget.orderNumber}-${idempotencyKey}`,
          paidAt: new Date().toISOString(),
        }, idempotencyKey);
        toast.success(`Payment successful. ${formatINR.format(amountDue)} collected for #${retryTarget.orderNumber}`);
        setRetryProcessing(false);
        setRetryTarget(null);
        setRetrySettlement(null);
        await Promise.all([loadOrders(), loadStats()]);
        return;
      }

      if (retryMethod === "CASHFREE") {
        const { data } = await createCashfreePayment(retryTarget._id, idempotencyKey);
        await openCashfreeCheckout(data?.data?.paymentSessionId, data?.data?.cashfreeEnvironment);
        return;
      }

      if (retryMethod === "HOTEL_UPI") {
        await processHotelUpiPayment();
        return;
      }

      const { data } = await createGatewayPayment({ orderId: retryTarget._id, provider: "razorpay", paymentMethod: retryMethod }, idempotencyKey);
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
            await verifyGatewayPayment({ orderId: retryTarget._id, provider: "razorpay", paymentMethod: retryMethod, razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id, razorpay_signature: response.razorpay_signature }, idempotencyKey);
            toast.success(`Payment successful. ${formatINR.format(amountDue)} collected for #${retryTarget.orderNumber}`);
            setRetryTarget(null);
            setRetrySettlement(null);
            await Promise.all([loadOrders(), loadStats()]);
          } catch (error) {
            toast.error(error?.response?.data?.message || "Payment verification failed");
          } finally {
            setRetryProcessing(false);
          }
        },
        modal: { ondismiss: () => { toast.error("Payment cancelled. You can retry again."); setRetryProcessing(false); } },
        prefill: { name: retryTarget.customer?.fullName || "Guest", email: retryTarget.customer?.email || "", contact: retryTarget.customer?.phone || "" },
        notes: { orderId: retryTarget.orderNumber },
        theme: { color: "#0f766e" },
      });
      rzp.on("payment.failed", () => { toast.error("Payment failed. You can retry again."); setRetryProcessing(false); });
      rzp.open();
    } catch (error) {
      toast.error(error?.response?.data?.message || error?.message || "Unable to start payment");
      setRetryProcessing(false);
    }
  };

  const submitCreate = async (payload) => {
    if (createSubmittingRef.current) return;
    createSubmittingRef.current = true;
    setCreateSubmitError("");
    setSaving(true);
    try {
      const { _idempotencyKey, ...orderPayload } = payload;
      const { data } = await createOrder(orderPayload, _idempotencyKey);
      const order = data.data;

      toast.success("Order created successfully");
      clearOrderDraft(getOrderDraftScope({ user, outletId: localStorage.getItem("selectedOutletId") || "" }));
      setCreateOpen(false);

      setCreatedOrder(order);
      setPaymentPromptOpen(true);
      await Promise.all([loadOrders(), loadStats()]);
    } catch (error) {
      if (error?.code === "ERR_CANCELED" || error?.name === "CanceledError") return;
      if (!error?.response && orderPayload?.items?.length) {
        try {
          const outletId = localStorage.getItem("selectedOutletId") || "";
          const scope = getOfflineOrderScope({ user, outletId });
          savePendingOfflineOrder({
            scope,
            outletId,
            userId: user?._id || user?.id,
            restaurantId: user?.restaurant?._id || user?.restaurant?.id || user?.restaurant,
            payload: orderPayload,
            idempotencyKey: _idempotencyKey,
          });
          toast.success("Order saved as Pending Sync. Retry it manually when the server is reachable.");
        } catch (offlineError) {
          toast.error(offlineError.message || "Unable to save offline order intent");
        }
      }
      const message = !error?.response
        ? "Unable to reach the server. Your draft is saved. Try again."
        : error?.response?.status >= 500
          ? "The server is unavailable. Your draft is saved. Try again."
          : error?.response?.data?.message || "Unable to create order";
      setCreateSubmitError(message);
      toast.error(message);
    } finally {
      createSubmittingRef.current = false;
      setSaving(false);
    }
  };

  const submitEdit = async (payload) => {
    if (!editOrder?._id) return;

    setSaving(true);
    try {
      const { data } = await updateOrder(editOrder._id, payload);
      const updatedOrder = data.data;
      setOrders((current) => {
        const next = current.map((order) => String(order._id) === String(updatedOrder._id) ? updatedOrder : order);
        cacheOrderList(activeOrderCacheKeyRef.current, next, meta);
        return next;
      });
      setDetailsOrder((current) => String(current?._id || "") === String(updatedOrder._id) ? updatedOrder : current);
      toast.success("Order updated successfully");
      setEditOpen(false);
      setEditOrder(null);
      await Promise.all([loadOrders(), loadStats()]);
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
      await Promise.all([loadOrders(), loadStats()]);
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
      await Promise.all([loadOrders(), loadStats()]);
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
    cashSettlementIdempotencyKeyRef.current = "";
  };

  const viewCreatedOrder = async () => {
    setPaymentPromptOpen(false);
    if (createdOrder) await openDetails(createdOrder);
  };

  const payCashNow = async () => {
    if (!createdOrder?._id || cashConfirmSubmittingRef.current) return;

    cashConfirmSubmittingRef.current = true;
    setCashConfirmLoading(true);
    try {
      const idempotencyKey = cashSettlementIdempotencyKeyRef.current
        || `cash-payment:${createdOrder._id}:${crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`}`;
      cashSettlementIdempotencyKeyRef.current = idempotencyKey;
      const { data } = await payOrder(createdOrder._id, {
        paymentMethod: createdOrder.paymentMethod || "CASH",
        paymentStatus: "PAID",
        gateway: "CASH",
        transactionId: `CASH-${createdOrder.orderNumber}-${idempotencyKey}`,
        paidAt: new Date().toISOString(),
      }, idempotencyKey);
      const confirmedOrder = data?.data;
      if (String(confirmedOrder?.paymentStatus || "").toUpperCase() !== "PAID") {
        throw new Error("The cash settlement was not confirmed by the server.");
      }
      orderRequestRef.current += 1;
      setOrders((current) => {
        const nextOrders = applyAuthoritativeCashPayment(current, confirmedOrder);
        if (nextOrders !== current && ordersCacheKeyRef.current === activeOrderCacheKeyRef.current) {
          cacheOrderList(ordersCacheKeyRef.current, nextOrders, meta);
        }
        return nextOrders;
      });
      toast.success("Cash payment marked as paid");
      closePaymentPrompt();
      void Promise.all([loadOrders(), loadStats()]);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to update cash payment");
    } finally {
      cashConfirmSubmittingRef.current = false;
      setCashConfirmLoading(false);
    }
  };

  const processGatewayPayment = async () => {
    if (!createdOrder?._id) return;

    const paymentMethod = String(createdOrder.paymentMethod || "").toUpperCase();
    if (paymentMethod === "CASH") {
      cashSettlementIdempotencyKeyRef.current = `cash-payment:${createdOrder._id}:${crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`}`;
      setCashConfirmOpen(true);
      return;
    }

    if (paymentMethod === "UPI") {
      if (!createHotelUpiCapability.canCollect) {
        toast.error(createHotelUpiCapability.reason || "Hotel UPI is unavailable.");
        return;
      }
      setPaymentProcessing(true);
      try {
        const qrData = await requestHotelUpiQr(createdOrder);
        setHotelPaymentData(qrData);
        setHotelPaymentOrder(createdOrder);
        setPaymentPromptOpen(false);
        setCreatedOrder(null);
        toast.success("Hotel UPI QR generated. Payment remains pending independent verification.");
      } catch (error) {
        toast.error(error?.response?.data?.message || error?.message || "Unable to generate Hotel UPI QR");
      } finally {
        setPaymentProcessing(false);
      }
      return;
    }

    setPaymentProcessing(true);
    try {
      if (paymentMethod === "CASHFREE") {
        const { data } = await createCashfreePayment(createdOrder._id);
        await openCashfreeCheckout(data?.data?.paymentSessionId, data?.data?.cashfreeEnvironment);
        return;
      }
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
            await Promise.all([loadOrders(), loadStats()]);
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
    setCreateSubmitError("");
    setCreateOpen(true);
  }, []);

  const closeTopmostPanel = () => {
    if (paymentPromptOpen) { closePaymentPrompt(); return; }
    if (statusTarget) { setStatusTarget(null); setStatusValue(""); return; }
    if (deleteTarget) { if (!saving) setDeleteTarget(null); return; }
    if (cashConfirmOpen) { if (!cashConfirmLoading) setCashConfirmOpen(false); return; }
    if (hotelPaymentOrder) { closeHotelUpiPayment(); return; }
    if (retryTarget) { closeRetryPayment(); return; }
    if (receiptOpen) { setReceiptOpen(false); setReceiptPayment(null); return; }
    if (receiptPickerOpen) { setReceiptPickerOpen(false); setReceiptCandidates([]); return; }
    if (kitchenKot) { setKitchenKot(null); return; }
    if (detailsOpen) { setDetailsOpen(false); setDetailsOrder(null); return; }
    if (editOpen) { if (!saving) { setEditOpen(false); setEditOrder(null); } return; }
    if (createOpen) { if (!saving) { setCreateOpen(false); setCreateInitialTable(null); } return; }
    return false;
  };

  const operationalShortcutOrder = selectedOrder || detailsOrder || orders[0] || null;
  const hasOpenOrderDialog = Boolean(
    createOpen || editOpen || detailsOpen || kitchenKot || paymentPromptOpen || cashConfirmOpen || retryTarget || hotelPaymentOrder || deleteTarget || statusTarget || receiptOpen || receiptPickerOpen
  );
  useKeyboardShortcutScope({
    escape: { handler: closeTopmostPanel },
    f2: { handler: () => { if (isChef || hasOpenOrderDialog) return false; openCreate(); } },
    f7: { handler: () => { if (!operationalShortcutOrder || hasOpenOrderDialog) return false; openKitchenKot(operationalShortcutOrder); } },
    f8: { handler: () => {
      if (!canCollectPayments || !operationalShortcutOrder || hasOpenOrderDialog) return false;
      if (["PAID", "REFUNDED", "CANCELLED"].includes(String(operationalShortcutOrder.paymentStatus || "").toUpperCase())) return false;
      openRetryPayment(operationalShortcutOrder);
    } },
    f9: { handler: () => {
      if (hasOpenOrderDialog) return false;
      if (!selectedOrder) {
        toast.error("Select an order to open its payment receipt.");
        return;
      }
      void openReceipt(selectedOrder);
    } },
  }, { priority: 20 });

  const refreshOfflineCount = useCallback(() => {
    const scope = getOfflineOrderScope({ user, outletId: localStorage.getItem("selectedOutletId") || "" });
    setPendingOfflineCount(scope ? listPendingOfflineOrders(scope).length : 0);
  }, [user]);

  useEffect(() => { refreshOfflineCount(); }, [refreshOfflineCount]);

  const syncOfflineOrders = useCallback(async () => {
    const scope = getOfflineOrderScope({ user, outletId: localStorage.getItem("selectedOutletId") || "" });
    if (!scope) return;
    const results = await syncPendingOfflineOrders(scope);
    const synced = results.filter((result) => result.order).length;
    if (synced) await Promise.all([loadOrders(), loadStats()]);
    refreshOfflineCount();
    toast.success(synced ? `${synced} offline order${synced === 1 ? "" : "s"} synced.` : "No offline orders synced.");
  }, [loadOrders, loadStats, refreshOfflineCount, user]);

  const requestDelete = useCallback((order) => setDeleteTarget(order), []);
  const hasCurrentOrders = Boolean(orderCacheKey) && ordersCacheKey === orderCacheKey;
  const currentOrdersError = ordersErrorCacheKey === orderCacheKey ? ordersError : "";
  const visibleOrders = hasCurrentOrders ? orders : [];
  const visibleMeta = hasCurrentOrders ? meta : { page: filters.page, limit: 20, total: 0, totalPages: 1 };
  const orderTableLoading = Boolean(orderCacheKey)
    && !hasCurrentOrders
    && !currentOrdersError
    && (initialLoadingOrders || !backgroundRefreshingOrders);

  return (
    <div className="ui-page">
      <div className="ui-page-header">
        <div className="min-w-0">
          <h2 className="ui-page-title">Orders</h2>
          <p className="ui-page-description">Review live order status, table context, kitchen progress and payment state.</p>
          {backgroundRefreshingOrders && hasCurrentOrders ? <p className="mt-1 text-xs font-medium text-slate-500" role="status">Refreshing orders…</p> : null}
        </div>
        {!isChef && <button type="button" onClick={openCreate} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800 lg:hidden">
          <FiPlus className="h-4 w-4" aria-hidden="true" /> New Order
        </button>}
      </div>

      {!isChef && <OrderStats stats={stats} loading={loadingStats} />}

      {!isChef && pendingOfflineCount ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <span>{pendingOfflineCount} order{pendingOfflineCount === 1 ? "" : "s"} pending sync. Server validation is required before creation.</span>
          <button type="button" onClick={syncOfflineOrders} className="rounded-lg bg-amber-700 px-3 py-2 font-semibold text-white hover:bg-amber-800">Retry Sync</button>
        </div>
      ) : null}

      {!isChef && <OrderToolbar
        filters={filters}
        onChange={setFilters}
        onCreate={openCreate}
      />}

      <OrderTable
        orders={visibleOrders}
        loading={orderTableLoading}
        error={!hasCurrentOrders ? currentOrdersError : ""}
        selectedOrderId={selectedOrder?._id}
        onSelect={setSelectedOrder}
        hasFilters={Boolean(filters.search || filters.status || filters.orderType || filters.paymentStatus || filters.date)}
        onOpen={openDetails}
        onEdit={openEdit}
        onDelete={requestDelete}
        onRetryPayment={openRetryPayment}
        onPrintKot={openKitchenKot}
        canCollectPayments={canCollectPayments}
        kitchenOnly={isChef}
        simplePrintedKotWorkflow={simplePrintedKotWorkflow}
      />
      {currentOrdersError ? <RequestState message={currentOrdersError} onRetry={() => loadOrders()} /> : null}

      <TablePagination meta={visibleMeta} onPageChange={goToPage} itemLabel="orders" className="ui-card" />

      {!isChef && <CreateOrderModal
        open={createOpen}
        loading={saving}
        menuItems={foods}
        categories={categories}
        tables={tables}
        dependenciesLoading={dependenciesLoading}
        dependenciesReady={dependenciesReady}
        dependenciesError={dependenciesError}
        tablesLoading={tablesLoading}
        onRetryDependencies={() => void loadOrderDependencies()}
        submissionError={createSubmitError}
        initialData={createInitialTable ? { table: createInitialTable } : null}
        hotelUpiCapability={createHotelUpiCapability}
        restaurantGstRate={restaurantGstRate}
        restaurantDefaultDiscountPercent={restaurantDefaultDiscountPercent}
        onClose={() => {
          setCreateOpen(false);
          setCreateInitialTable(null);
        }}
        onSubmit={submitCreate}
      />}

      {!isChef && <EditOrderModal
        open={editOpen}
        loading={saving}
        menuItems={foods}
        categories={categories}
        tables={tables}
        dependenciesLoading={dependenciesLoading}
        dependenciesReady={dependenciesReady}
        dependenciesError={dependenciesError}
        tablesLoading={tablesLoading}
        onRetryDependencies={() => void loadOrderDependencies()}
        initialData={editOrder}
        onClose={() => {
          setEditOpen(false);
          setEditOrder(null);
        }}
        onSubmit={submitEdit}
      />}

      <OrderDetailsDrawer
        open={detailsOpen}
        order={detailsOrder}
        loading={detailsLoading}
        onClose={() => {
          setDetailsOpen(false);
          setDetailsOrder(null);
        }}
        onViewReceipt={isChef ? undefined : openReceipt}
        onPrintReceipt={isChef ? undefined : openReceipt}
        onPrintKot={openKitchenKot}
      />
      <ReceiptPaymentPicker
        open={receiptPickerOpen}
        order={selectedOrder}
        payments={receiptCandidates}
        loadingPaymentId={receiptLoadingPaymentId}
        onClose={() => { if (!receiptLoadingPaymentId) { setReceiptPickerOpen(false); setReceiptCandidates([]); } }}
        onSelect={(payment) => { void openReceiptPayment(payment); }}
      />
      <PaymentReceipt
        open={receiptOpen}
        payment={receiptPayment}
        downloading={receiptDownloadLoading}
        onClose={() => { if (!receiptDownloadLoading) { setReceiptOpen(false); setReceiptPayment(null); } }}
        onDownload={downloadReceipt}
        onPrint={printReceipt}
      />
      <KitchenKotReceipt kot={kitchenKot} onClose={() => setKitchenKot(null)} />

      <RetryPaymentModal
        open={Boolean(retryTarget)}
        order={retryTarget}
        settlement={retrySettlement}
        method={retryMethod}
        onMethodChange={setRetryMethod}
        loading={retryProcessing}
        hotelUpiAvailable={retryHotelUpiCapability.canCollect}
        hotelUpiReason={retryHotelUpiCapability.reason}
        hotelUpiOnly={retryHotelUpiOnly}
        onClose={closeRetryPayment}
        onConfirm={processRetryPayment}
      />

      <HotelUpiPaymentModal
        open={Boolean(hotelPaymentOrder)}
        order={hotelPaymentOrder}
        payment={hotelPaymentData}
        loading={hotelPaymentActionLoading}
        onGenerate={() => requestHotelUpiQr(hotelPaymentOrder).then(() => toast.success("A new Hotel UPI QR is ready for the current outstanding balance.")).catch((error) => toast.error(error?.response?.data?.message || error?.message || "Unable to regenerate Hotel UPI QR"))}
        onRefreshStatus={refreshHotelUpiStatus}
        onConfirmPaymentReceived={confirmHotelUpiPaymentReceived}
        onReceipt={downloadHotelUpiReceipt}
        onClose={closeHotelUpiPayment}
      />

      {!isChef && <CashPaymentConfirmationModal
        open={cashConfirmOpen}
        amount={createdOrder ? formatINR.format(Number(createdOrder.total || 0)) : "₹0"}
        loading={cashConfirmLoading}
        onClose={() => setCashConfirmOpen(false)}
        onConfirm={payCashNow}
      />}

      {!isChef && <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Order?"
        message={`Are you sure you want to delete order #${deleteTarget?.orderNumber || deleteTarget?._id}?\nThis action cannot be undone.`}
        onCancel={() => {
          if (saving) return;
          setDeleteTarget(null);
        }}
        onConfirm={confirmDelete}
        loading={saving}
      />}

      {statusTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="max-h-[90dvh] w-full max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:max-w-md sm:p-5">
            <h3 className="text-lg font-semibold text-slate-900">Update Order Status</h3>
            <p className="mt-1 text-sm text-slate-500">{statusTarget.orderNumber}</p>

            {!selectedStatusOptions.length ? (
              <p className="mt-3 text-sm text-slate-600">No further status transition is allowed for this order.</p>
            ) : (
              <select className="mt-3 min-h-11 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15" value={statusValue} onChange={(e) => setStatusValue(e.target.value)}>
                <option value="">Select next status</option>
                {selectedStatusOptions.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            )}

            <div className="mt-4 grid grid-cols-1 gap-2 sm:flex sm:justify-end sm:gap-3">
              <button type="button" onClick={() => setStatusTarget(null)} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm">Cancel</button>
              <button type="button" onClick={submitStatusUpdate} disabled={saving || !statusValue} className="min-h-11 rounded-xl bg-brand-700 px-4 py-2 text-sm text-white disabled:opacity-60">Update</button>
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
