import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import { FiCalendar, FiX } from "react-icons/fi";
import { addOrderCustomer, searchOrderCustomers } from "../../../services/orderService";
import { calculateOrderTotals, normalizeGstRate } from "../../../utils/orderCalculations";
import CustomerSection from "./create/CustomerSection";
import ItemsSection from "./create/ItemsSection";
import OrderDetailsSection from "./create/OrderDetailsSection";
import SummaryPanel from "./create/SummaryPanel";
import { clearOrderDraft, getOrderDraftScope, readOrderDraft, writeOrderDraft } from "../../../utils/orderDraft";
import { useKeyboardShortcutScope } from "../../../context/useKeyboardShortcutScope";
import { useOrderModalKeyboardNavigation } from "../../../utils/orderModalNavigation";

const newIdempotencyKey = () => globalThis.crypto?.randomUUID?.() || `order-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const derivePercent = (amount, base) => {
  if (!base || base <= 0) return "";
  const percent = (Number(amount || 0) / base) * 100;
  return Number.isFinite(percent) ? String(Math.round(percent * 100) / 100) : "";
};

const normalizePercentInput = (value) => {
  if (value === "") return "";
  if (/^\d+\.$/.test(value)) return value;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "";
  if (numeric < 0) return "0";
  if (numeric > 100) return "100";
  return value;
};

const mapOrderItem = (item, menuItems, categories) => {
  const menuItemId = item.menuItem?._id || item.menuItem || item.food?._id || item.food;
  const menuRef = menuItems.find((entry) => String(entry._id) === String(menuItemId));
  const categoryId = menuRef?.category?._id || menuRef?.category;
  const categoryName =
    menuRef?.category?.name ||
    categories.find((cat) => String(cat._id) === String(categoryId))?.name ||
    "";

  return {
    menuItem: menuItemId,
    name: item.name || menuRef?.name || "Menu Item",
    price: Number(item.price ?? menuRef?.price ?? 0),
    quantity: Math.max(1, Number(item.quantity || 1)),
    description: menuRef?.description || "",
    image: menuRef?.image || "",
    category: categoryId,
    categoryName,
  };
};

const buildInitialState = (initialData, menuItems, categories, restaurantGstRate) => {
  const subtotal = Number(initialData?.subtotal || 0);
  const discount = Number(initialData?.discount || 0);
  const taxableBase = Math.max(0, subtotal - discount);

  return {
    orderType: initialData?.orderType || "DINE_IN",
    table: initialData?.table?._id || initialData?.table || "",
    customer: initialData?.customer?._id ? initialData.customer : null,
    items: (initialData?.items || []).map((item) => mapOrderItem(item, menuItems, categories)),

    notes: initialData?.notes || "",
    discountPercent: derivePercent(discount, subtotal),
    taxPercent: normalizeGstRate(initialData?.gstRate ?? restaurantGstRate),
    serviceChargePercent: derivePercent(initialData?.serviceCharge, taxableBase),
    deliveryCharge: initialData?.deliveryCharge ?? "",
    deliveryAddress: initialData?.deliveryAddress || "",
    paymentMethod: String(initialData?.paymentMethod || "").toUpperCase() === "CASHFREE" ? "cashfree" : initialData?.paymentMethod || "CASH",
    paymentStatus: initialData?.paymentStatus || "PENDING",
    idempotencyKey: initialData?.idempotencyKey || "",
  };
};

const formatLocalDate = (date) =>
  date.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });

const formatLocalTime = (date) =>
  date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });

const CreateOrderModal = ({
  open,
  loading,
  menuItems = [],
  categories = [],
  tables = [],
  dependenciesLoading = false,
  dependenciesReady = false,
  dependenciesError = "",
  tablesLoading = false,
  onRetryDependencies,
  submissionError = "",
  initialData = null,
  hotelUpiCapability,
  restaurantGstRate = 0,
  onClose,
  onSubmit,
}) => {
  const isEdit = Boolean(initialData?._id);
  const { user, activeOutletId } = useSelector((state) => state.auth);
  const outletId = activeOutletId || localStorage.getItem("selectedOutletId") || "";
  const draftScope = getOrderDraftScope({ user, outletId });

  const [form, setForm] = useState(() => buildInitialState(initialData, menuItems, categories, restaurantGstRate));
  const [guestCount, setGuestCount] = useState(1);
  const [orderDate, setOrderDate] = useState(() => new Date());
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState([]);
  const [customerSearching, setCustomerSearching] = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [customerForm, setCustomerForm] = useState({ fullName: "", email: "", phone: "" });
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [errors, setErrors] = useState({});
  const menuSearchRef = useRef(null);
  const tableSelectRef = useRef(null);
  const modalRef = useRef(null);
  const [submissionMessage, setSubmissionMessage] = useState("");
  const [draftCandidate, setDraftCandidate] = useState(null);
  const [draftResolution, setDraftResolution] = useState("new");
  const modalSessionRef = useRef("");
  const latestFormRef = useRef(form);
  latestFormRef.current = form;

  const patchForm = useCallback((updates) => {
    setForm((prev) => ({ ...prev, ...updates }));
    setErrors((prev) => {
      if (!Object.keys(updates).some((key) => prev[key])) return prev;
      const next = { ...prev };
      Object.keys(updates).forEach((key) => {
        if (next[key]) delete next[key];
      });
      return next;
    });
  }, []);

  // A modal session is initialized once. Re-running this when paginated menu
  // data arrives used to silently restore and reset a draft multiple times.
  useLayoutEffect(() => {
    if (!open) {
      modalSessionRef.current = "";
      return;
    }

    const sessionKey = `${isEdit ? `edit:${initialData?._id || ""}` : "create"}:${draftScope || ""}`;
    if (modalSessionRef.current === sessionKey) return;
    modalSessionRef.current = sessionKey;

    const initialForm = buildInitialState(initialData, menuItems, categories, restaurantGstRate);
    if (!isEdit && !initialForm.idempotencyKey) initialForm.idempotencyKey = newIdempotencyKey();
    const draft = !isEdit ? readOrderDraft(draftScope) : null;

    setForm(initialForm);
    setDraftCandidate(draft);
    setDraftResolution(draft ? "choose" : "new");
    setCustomerSearch("");
    setCustomerResults([]);
    setShowCustomerForm(false);
    setCustomerForm({ fullName: "", email: "", phone: "" });
    setErrors({});
    setSubmissionMessage("");
    setGuestCount(1);
    setOrderDate(initialData?.createdAt ? new Date(initialData.createdAt) : new Date());
  }, [categories, draftScope, initialData, initialData?._id, isEdit, menuItems, open, restaurantGstRate]);

  useEffect(() => {
    if (!open || isEdit || !draftScope || draftResolution === "choose" || draftResolution === "confirm-new" || !form.items.length) return undefined;
    const timer = window.setTimeout(() => writeOrderDraft(draftScope, form), 350);
    return () => window.clearTimeout(timer);
  }, [draftResolution, draftScope, form, isEdit, open]);

  // Closing the dialog or refreshing must retain the local, tenant-scoped draft.
  useEffect(() => {
    if (!open || isEdit || !draftScope || draftResolution === "choose" || draftResolution === "confirm-new") return undefined;
    const persistDraft = () => {
      if (latestFormRef.current.items.length) writeOrderDraft(draftScope, latestFormRef.current);
    };
    window.addEventListener("pagehide", persistDraft);
    return () => {
      persistDraft();
      window.removeEventListener("pagehide", persistDraft);
    };
  }, [draftResolution, draftScope, isEdit, open]);

  useEffect(() => {
    if (!open) return undefined;
    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const term = customerSearch.trim();
    if (term.length < 2) {
      setCustomerResults([]);
      return undefined;
    }

    const timer = setTimeout(async () => {
      setCustomerSearching(true);
      try {
        const { data } = await searchOrderCustomers(term);
        setCustomerResults(data.data || []);
      } catch {
        setCustomerResults([]);
        toast.error("Unable to search customers");
      } finally {
        setCustomerSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [customerSearch, open]);

  const totals = useMemo(
    () =>
      calculateOrderTotals({
        items: form.items,
        discountPercent: form.discountPercent,
        taxPercent: form.taxPercent,
        serviceChargePercent: form.serviceChargePercent,
        deliveryCharge: form.deliveryCharge,
        orderType: form.orderType,
      }),
    [form.items, form.discountPercent, form.taxPercent, form.serviceChargePercent, form.deliveryCharge, form.orderType]
  );
  const discountAmount = totals.discount;

  const isTableSelectable = useCallback((table) => {
    // Only MAINTENANCE tables are invalid for seating. AVAILABLE, OCCUPIED and
    // RESERVED tables can all host (additional) DINE_IN orders.
    const status = String(table.status || "").toUpperCase();
    return status !== "MAINTENANCE";
  }, []);

  const getOccupiedTableMessage = (table) => {
    const label = table?.tableNumber ? `Table ${table.tableNumber}` : "Selected table";
    return `${label} is under maintenance and cannot be selected.`;
  };

  const addMenuItem = useCallback((item) => {
    const categoryId = item.category?._id || item.category;
    const categoryName = item.category?.name || categories.find((c) => String(c._id) === String(categoryId))?.name || "";

    setForm((prev) => {
      const existing = prev.items.find((entry) => String(entry.menuItem) === String(item._id));
      const items = existing
        ? prev.items.map((entry) =>
            String(entry.menuItem) === String(item._id)
              ? { ...entry, quantity: entry.quantity + 1 }
              : entry
          )
        : [
            ...prev.items,
            {
              menuItem: item._id,
              name: item.name,
              price: Number(item.price || 0),
              quantity: 1,
              description: item.description || "",
              image: item.image || "",
              category: categoryId,
              categoryName,
            },
          ];
      return { ...prev, items };
    });
    setErrors((prev) => (prev.items ? { ...prev, items: "" } : prev));
  }, [categories]);

  const updateItemQty = useCallback((menuItemId, delta) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((entry) =>
        String(entry.menuItem) === String(menuItemId)
          ? { ...entry, quantity: Math.max(1, entry.quantity + delta) }
          : entry
      ),
    }));
  }, []);

  const removeItem = useCallback((menuItemId) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((entry) => String(entry.menuItem) !== String(menuItemId)),
    }));
  }, []);

  const selectCustomer = useCallback((customer) => {
    patchForm({ customer });
    setCustomerSearch("");
    setCustomerResults([]);
    setShowCustomerForm(false);
  }, [patchForm]);

  const clearCustomer = useCallback(() => patchForm({ customer: null }), [patchForm]);
  const openCustomerForm = useCallback(() => setShowCustomerForm(true), []);
  const closeCustomerForm = useCallback(() => {
    setShowCustomerForm(false);
    if (!form.customer) setCustomerForm({ fullName: "", email: "", phone: "" });
  }, [form.customer]);
  const openCustomerEditForm = useCallback(() => {
    if (!form.customer) return;
    setCustomerForm({ fullName: form.customer.fullName || "", email: form.customer.email || "", phone: form.customer.phone || "" });
    setShowCustomerForm(true);
  }, [form.customer]);
  const patchCustomerForm = useCallback((updates) => setCustomerForm((prev) => ({ ...prev, ...updates })), []);
  const patchDiscountPercent = useCallback((value) => patchForm({ discountPercent: normalizePercentInput(value) }), [patchForm]);
  const patchNotes = useCallback((value) => patchForm({ notes: value }), [patchForm]);
  const patchServiceChargePercent = useCallback((value) => patchForm({ serviceChargePercent: value }), [patchForm]);

  const saveCustomer = useCallback(async () => {
    const fullName = customerForm.fullName.trim();
    const email = customerForm.email.trim();
    const phone = customerForm.phone.trim();

    if (!fullName) {
      toast.error("Customer name is required");
      return;
    }
    if (!email && !phone) {
      toast.error("Email or phone is required");
      return;
    }

    setSavingCustomer(true);
    try {
      const { data } = await addOrderCustomer({ fullName, email, phone });
      selectCustomer(data.data);
      toast.success(data.message || "Customer saved");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to save customer");
    } finally {
      setSavingCustomer(false);
    }
  }, [customerForm, selectCustomer]);

  const restoreDraft = useCallback(() => {
    if (!draftCandidate || !dependenciesReady) return;
    const restoredForm = {
      ...buildInitialState(initialData, menuItems, categories, restaurantGstRate),
      ...buildInitialState(draftCandidate, menuItems, categories, restaurantGstRate),
    };
    if (!restoredForm.idempotencyKey) restoredForm.idempotencyKey = newIdempotencyKey();
    setForm(restoredForm);
    setDraftCandidate(null);
    setDraftResolution("restored");
  }, [categories, dependenciesReady, draftCandidate, initialData, menuItems, restaurantGstRate]);

  const requestNewOrder = useCallback(() => setDraftResolution("confirm-new"), []);

  const startNewOrder = useCallback(() => {
    clearOrderDraft(draftScope);
    const initialForm = buildInitialState(initialData, menuItems, categories, restaurantGstRate);
    if (!initialForm.idempotencyKey) initialForm.idempotencyKey = newIdempotencyKey();
    setForm(initialForm);
    setDraftCandidate(null);
    setDraftResolution("new");
  }, [categories, draftScope, initialData, menuItems, restaurantGstRate]);
  const validate = () => {
    const next = {};
    if (!form.items.length) next.items = "Add at least one food item.";
    if (form.orderType === "DINE_IN" && !form.table) next.table = "Select a table for dine-in orders.";
    if (form.orderType === "DINE_IN" && form.table) {
      const table = tables.find((t) => String(t._id) === String(form.table));
      if (table && !isTableSelectable(table)) {
        next.table = getOccupiedTableMessage(table);
      }
    }
    if (form.orderType === "DELIVERY" && !form.deliveryAddress.trim()) {
      next.deliveryAddress = "Delivery address is required.";
    }
    if (String(form.paymentMethod).toLowerCase() === "cashfree" && !String(form.customer?.phone || "").trim()) {
      next.customer = "Cashfree requires a customer with a phone number.";
    }
    setErrors(next);
    if (Object.keys(next).length) {
      toast.error("Please fix the highlighted fields.");
      return false;
    }
    return true;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!validate()) return;
    if (!navigator.onLine) {
      writeOrderDraft(draftScope, form);
      setSubmissionMessage("Connection required to submit order. Your draft is saved.");
      return;
    }
    setSubmissionMessage("");
    onSubmit({
      orderType: form.orderType,
      table: form.orderType === "DINE_IN" ? form.table : null,
      // The API resolves names and prices from the current tenant menu. Only
      // menu identifiers and quantities are user-editable order input.
      items: form.items.map(({ menuItem, quantity }) => ({ menuItem, quantity })),

      notes: form.notes.trim(),
      discount: discountAmount,
      serviceChargePercent: Number(form.serviceChargePercent) || 0,
      deliveryCharge: form.orderType === "DELIVERY" ? Number(form.deliveryCharge) || 0 : 0,
      deliveryAddress: form.orderType === "DELIVERY" ? form.deliveryAddress.trim() : "",
      ...(!isEdit ? {
        customer: form.customer?._id || null,
        paymentMethod: form.paymentMethod,
        _idempotencyKey: form.idempotencyKey,
      } : {}),
    });
  };

  const awaitingDraftDecision = !isEdit && (draftResolution === "choose" || draftResolution === "confirm-new");
  const { onKeyDownCapture } = useOrderModalKeyboardNavigation({
    open,
    modalRef,
    focusKey: open ? "order-form" : "",
    onCartQuantity: updateItemQty,
  });

  useKeyboardShortcutScope({
    escape: { handler: () => { if (loading) return false; onClose(); } },
    f3: { allowInEditable: true, handler: () => { if (form.orderType !== "DINE_IN") return false; tableSelectRef.current?.focus(); } },
    f4: { allowInEditable: true, handler: () => { if (isEdit) return false; patchForm({ orderType: "TAKEAWAY", table: "" }); } },
    "ctrl+enter": { allowInEditable: true, handler: () => { if (loading || draftResolution === "choose" || draftResolution === "confirm-new") return false; handleSubmit({ preventDefault() {} }); } },
  }, { enabled: open, priority: 110 });

  if (!open) return null;

  const itemCount = totals.itemCount;

  return (
    <div
      ref={modalRef}
      onKeyDownCapture={onKeyDownCapture}
      data-order-navigation-modal="true"
      className="fixed inset-0 z-50 flex items-stretch justify-center overflow-hidden bg-slate-900/55 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-order-title"
    >
      <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-[96dvh] sm:w-[96vw] sm:max-w-[1600px] sm:rounded-xl sm:border sm:border-slate-200">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5 sm:px-5">
          <div className="min-w-0 flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <FiCalendar className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id="create-order-title" className="text-lg font-bold text-slate-900 sm:text-xl">
                {isEdit ? "Edit Order" : "Create New Order"}
              </h2>
              <p className="text-xs text-slate-500">
                {isEdit ? "Correct order details and items" : "Add items, manage order details and create a new order"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600/30"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          {awaitingDraftDecision ? <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto p-4 sm:p-6">
            <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="order-draft-choice-title">
              <h3 id="order-draft-choice-title" className="text-lg font-bold text-slate-900">{draftResolution === "confirm-new" ? "Start a new order?" : "Unsent order found"}</h3>
              {draftResolution === "confirm-new" ? <p className="mt-2 text-sm text-slate-600">This clears only this local unsent draft for the current user, restaurant and outlet. Saved orders and payments are not affected.</p> : <p className="mt-2 text-sm text-slate-600">Choose whether to restore the local unsent order for this user, restaurant and outlet, or start a new order.</p>}
              {dependenciesError ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert"><p>{dependenciesError}</p><button type="button" onClick={onRetryDependencies} disabled={dependenciesLoading} className="mt-2 min-h-10 rounded-lg border border-rose-300 bg-white px-3 text-sm font-semibold text-rose-800 disabled:opacity-60">Retry menu loading</button></div> : null}
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                {draftResolution === "confirm-new" ? <><button type="button" onClick={() => setDraftResolution("choose")} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700">Keep Draft</button><button type="button" onClick={startNewOrder} data-order-primary-focus="true" className="min-h-11 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white">Confirm Start New Order</button></> : <><button type="button" onClick={requestNewOrder} data-order-primary-focus="true" className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700">Start New Order</button><button type="button" onClick={restoreDraft} disabled={!dependenciesReady || dependenciesLoading} className="min-h-11 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60">{dependenciesLoading || !dependenciesReady ? "Loading menu…" : "Restore Draft"}</button></>}
              </div>
            </section>
          </div> : <>
          <div data-order-form-layout="true" className="grid min-h-0 flex-1 overflow-y-auto overscroll-contain lg:grid-cols-[minmax(0,7fr)_minmax(300px,3fr)]">
            <div data-order-form-left="true" className="min-w-0 divide-y divide-slate-200">
              <CustomerSection
                customer={form.customer}
                readOnly={isEdit}
                customerSearch={customerSearch}
                customerResults={customerResults}
                customerSearching={customerSearching}
                showCustomerForm={showCustomerForm}
                customerForm={customerForm}
                savingCustomer={savingCustomer}
                errors={errors}
                onSearchChange={setCustomerSearch}
                onSelectCustomer={selectCustomer}
                onClearCustomer={clearCustomer}
                onOpenAddForm={openCustomerForm}
                onOpenEditForm={openCustomerEditForm}
                onCloseForm={closeCustomerForm}
                onFormChange={patchCustomerForm}
                onSaveCustomer={saveCustomer}
              />

              <OrderDetailsSection
                orderType={form.orderType}
                tableId={form.table}
                paymentMethod={form.paymentMethod}
                paymentStatus={form.paymentStatus}
                deliveryAddress={form.deliveryAddress}
                deliveryCharge={form.deliveryCharge}
                customer={form.customer}
                readOnly={isEdit}
                guestCount={guestCount}
                orderDateLabel={formatLocalDate(orderDate)}
                orderTimeLabel={formatLocalTime(orderDate)}
                tables={tables}
                tablesLoading={tablesLoading}
                isEdit={isEdit}
                errors={errors}
                onPatch={patchForm}
                onGuestChange={setGuestCount}
                isTableSelectable={isTableSelectable}
                hotelUpiCapability={hotelUpiCapability}
                tableSelectRef={tableSelectRef}
              />

              <ItemsSection
                menuSearchRef={menuSearchRef}
                menuItems={menuItems}
                categories={categories}
                menuLoading={dependenciesLoading}
                menuError={dependenciesError}
                onRetryMenu={onRetryDependencies}
                items={form.items}
                errors={errors}
                discountPercent={form.discountPercent}
                onAddItem={addMenuItem}
                onUpdateQty={updateItemQty}
                onRemoveItem={removeItem}
                onDiscountPercentChange={patchDiscountPercent}
              />
            </div>

            <SummaryPanel
              itemCount={itemCount}
              totals={totals}
              discountPercent={form.discountPercent}
              taxPercent={form.taxPercent}
              serviceChargePercent={form.serviceChargePercent}
              orderType={form.orderType}
              notes={form.notes}
              onNotesChange={patchNotes}
              onServiceChargePercentChange={patchServiceChargePercent}
            />
          </div>

          {/* Bottom action bar */}
          <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-slate-200 bg-white px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] sm:flex sm:items-center sm:justify-end sm:px-5">
            {submissionMessage || submissionError ? <p className="col-span-2 text-sm text-amber-800 sm:mr-auto" role="status">{submissionMessage || submissionError}</p> : null}
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="min-h-10 w-full rounded-lg border border-slate-300 px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-600/30 disabled:opacity-60 sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="min-h-10 w-full rounded-lg bg-brand-700 px-6 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 focus:outline-none focus:ring-2 focus:ring-brand-600/40 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
            >
              {loading ? (isEdit ? "Updating Order..." : "Creating Order...") : isEdit ? "Update Order" : "Create Order"}
            </button>
          </div>
          </>}
        </form>
      </div>
    </div>
  );
};

export default CreateOrderModal;
