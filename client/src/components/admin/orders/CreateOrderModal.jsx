import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import { FiCalendar, FiShoppingBag, FiX } from "react-icons/fi";
import { addOrderCustomer, searchOrderCustomers } from "../../../services/orderService";
import { calculateOrderTotals } from "../../../utils/orderCalculations";
import { currency } from "../../../utils/format";
import CustomerSection from "./create/CustomerSection";
import ItemsSection from "./create/ItemsSection";
import OrderDetailsSection from "./create/OrderDetailsSection";
import SummaryPanel from "./create/SummaryPanel";
import { INSTRUCTIONS_MAX, cardClass, fieldClass, labelClass } from "./create/constants";
import { getOrderDraftScope, readOrderDraft, writeOrderDraft } from "../../../utils/orderDraft";

const round2 = (v) => Math.round((Number(v) + Number.EPSILON) * 100) / 100;
const newIdempotencyKey = () => globalThis.crypto?.randomUUID?.() || `order-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const derivePercent = (amount, base) => {
  if (!base || base <= 0) return "";
  const percent = (Number(amount || 0) / base) * 100;
  return Number.isFinite(percent) ? String(Math.round(percent * 100) / 100) : "";
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

const buildInitialState = (initialData, menuItems, categories) => {
  const subtotal = Number(initialData?.subtotal || 0);
  const discount = Number(initialData?.discount || 0);
  const taxableBase = Math.max(0, subtotal - discount);

  return {
    orderType: initialData?.orderType || "DINE_IN",
    table: initialData?.table?._id || initialData?.table || "",
    customer: initialData?.customer?._id ? initialData.customer : null,
    items: (initialData?.items || []).map((item) => mapOrderItem(item, menuItems, categories)),
    specialInstructions: initialData?.specialInstructions || "",
    notes: initialData?.notes || "",
    discountPercent: derivePercent(discount, subtotal),
    taxPercent: 18,
    serviceChargePercent: derivePercent(initialData?.serviceCharge, taxableBase),
    deliveryCharge: initialData?.deliveryCharge ?? "",
    deliveryAddress: initialData?.deliveryAddress || "",
    paymentMethod: initialData?.paymentMethod || "CASH",
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
  submissionError = "",
  initialData = null,
  onClose,
  onSubmit,
}) => {
  const isEdit = Boolean(initialData?._id);
  const user = useSelector((state) => state.auth.user);
  const outletId = localStorage.getItem("selectedOutletId") || "";
  const draftScope = getOrderDraftScope({ user, outletId });

  const [form, setForm] = useState(() => buildInitialState(initialData, menuItems, categories));
  const [guestCount, setGuestCount] = useState(1);
  const [orderDate, setOrderDate] = useState(() => new Date());
  const [menuSearch, setMenuSearch] = useState("");
  const [menuCategory, setMenuCategory] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState([]);
  const [customerSearching, setCustomerSearching] = useState(false);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [customerForm, setCustomerForm] = useState({ fullName: "", email: "", phone: "" });
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [errors, setErrors] = useState({});
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const menuSearchRef = useRef(null);
  const [submissionMessage, setSubmissionMessage] = useState("");

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

  useEffect(() => {
    if (!open) return;
    const initialForm = buildInitialState(initialData, menuItems, categories);
    const draft = !isEdit ? readOrderDraft(draftScope) : null;
    const restoredForm = draft ? { ...initialForm, ...buildInitialState(draft, menuItems, categories) } : initialForm;
    if (!isEdit && !restoredForm.idempotencyKey) restoredForm.idempotencyKey = newIdempotencyKey();
    setForm(restoredForm);
    if (draft) toast.success("Unsent order restored.", { id: "order-draft-restored" });
    setMenuSearch("");
    setMenuCategory("");
    setCustomerSearch("");
    setCustomerResults([]);
    setShowCustomerForm(false);
    setCustomerForm({ fullName: "", email: "", phone: "" });
    setErrors({});
    setSubmissionMessage("");
    setGuestCount(1);
    setMobileCartOpen(false);

    if (initialData?.createdAt) {
      const created = new Date(initialData.createdAt);
      setOrderDate(created);
    } else {
      setOrderDate(new Date());
    }
  }, [draftScope, initialData, isEdit, menuItems, categories, open]);

  useEffect(() => {
    if (!open || isEdit || !draftScope || !form.items.length) return undefined;
    const timer = window.setTimeout(() => writeOrderDraft(draftScope, form), 350);
    return () => window.clearTimeout(timer);
  }, [draftScope, form, isEdit, open]);

  useEffect(() => {
    if (!open) return undefined;
    const onShortcut = (event) => {
      const tag = String(event.target?.tagName || "").toLowerCase();
      if (event.key !== "/" || tag === "input" || tag === "textarea" || event.target?.isContentEditable) return;
      event.preventDefault();
      menuSearchRef.current?.focus();
    };
    document.addEventListener("keydown", onShortcut);
    return () => document.removeEventListener("keydown", onShortcut);
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

  const rawSubtotal = useMemo(
    () => form.items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0),
    [form.items]
  );

  const discountAmount = useMemo(() => {
    const pct = Math.max(0, Math.min(100, Number(form.discountPercent) || 0));
    return round2((rawSubtotal * pct) / 100);
  }, [form.discountPercent, rawSubtotal]);

  const totals = useMemo(
    () =>
      calculateOrderTotals({
        items: form.items,
        discount: discountAmount,
        taxPercent: form.taxPercent,
        serviceChargePercent: form.serviceChargePercent,
        deliveryCharge: form.deliveryCharge,
        orderType: form.orderType,
      }),
    [form.items, discountAmount, form.taxPercent, form.serviceChargePercent, form.deliveryCharge, form.orderType]
  );

  const filteredMenuItems = useMemo(() => {
    const query = menuSearch.trim().toLowerCase();
    return menuItems.filter((item) => {
      const matchesSearch =
        !query ||
        item.name?.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query);
      const categoryId = item.category?._id || item.category;
      const matchesCategory = !menuCategory || String(categoryId) === String(menuCategory);
      const available = item.isAvailable ?? item.available ?? true;
      return matchesSearch && matchesCategory && available;
    });
  }, [menuItems, menuSearch, menuCategory]);

  const getCategoryName = useCallback((item) => {
    if (item.categoryName) return item.categoryName;
    return categories.find((cat) => String(cat._id) === String(item.category))?.name || "—";
  }, [categories]);

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
    setErrors((prev) => ({ ...prev, items: "" }));
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
  const patchDiscountPercent = useCallback((value) => patchForm({ discountPercent: value }), [patchForm]);
  const patchNotes = useCallback((value) => patchForm({ notes: value }), [patchForm]);
  const patchTaxPercent = useCallback((value) => patchForm({ taxPercent: value }), [patchForm]);
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
      customer: form.customer?._id || null,
      orderType: form.orderType,
      table: form.orderType === "DINE_IN" ? form.table : null,
      items: form.items.map(({ menuItem, name, price, quantity }) => ({ menuItem, name, price, quantity })),
      specialInstructions: form.specialInstructions.trim(),
      notes: form.notes.trim(),
      discount: discountAmount,
      taxPercent: Number(form.taxPercent) || 0,
      serviceChargePercent: Number(form.serviceChargePercent) || 0,
      deliveryCharge: form.orderType === "DELIVERY" ? Number(form.deliveryCharge) || 0 : 0,
      deliveryAddress: form.orderType === "DELIVERY" ? form.deliveryAddress.trim() : "",
      paymentMethod: form.paymentMethod,
      paymentStatus: form.paymentStatus,
      _idempotencyKey: form.idempotencyKey,
    });
  };

  if (!open) return null;

  const itemCount = form.items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/55 p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-order-title"
    >
      <div className="my-0 flex max-h-[100dvh] w-full max-w-7xl flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-slate-100 shadow-2xl sm:my-2 sm:max-h-[calc(100dvh-1.5rem)] sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6 sm:py-4">
          <div className="min-w-0 flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <FiCalendar className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id="create-order-title" className="text-xl font-bold text-slate-900 sm:text-2xl">
                {isEdit ? "Edit Order" : "Create New Order"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Add items, manage order details and create a new order
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {itemCount > 0 ? <button type="button" onClick={() => setMobileCartOpen(true)} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-slate-900 px-3 text-sm font-semibold text-white lg:hidden" aria-label={`View cart with ${itemCount} items`}><FiShoppingBag aria-hidden="true" /> {itemCount} · {currency(totals.total)}</button> : null}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600/30"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="grid flex-1 gap-4 overflow-y-auto p-3 sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4 sm:space-y-5">
              <CustomerSection
                customer={form.customer}
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
                form={form}
                guestCount={guestCount}
                orderDateLabel={formatLocalDate(orderDate)}
                orderTimeLabel={formatLocalTime(orderDate)}
                tables={tables}
                tablesLoading={dependenciesLoading}
                isEdit={isEdit}
                errors={errors}
                onPatch={patchForm}
                onGuestChange={setGuestCount}
                isTableSelectable={isTableSelectable}
              />

              <ItemsSection
                menuSearchRef={menuSearchRef}
                menuSearch={menuSearch}
                menuCategory={menuCategory}
                categories={categories}
                filteredMenuItems={filteredMenuItems}
                menuLoading={dependenciesLoading}
                items={form.items}
                errors={errors}
                discountPercent={form.discountPercent}
                onMenuSearchChange={setMenuSearch}
                onCategoryChange={setMenuCategory}
                onAddItem={addMenuItem}
                onUpdateQty={updateItemQty}
                onRemoveItem={removeItem}
                onDiscountPercentChange={patchDiscountPercent}
                getCategoryName={getCategoryName}
                totals={totals}
                orderType={form.orderType}
                mobileCartOpen={mobileCartOpen}
                onCloseMobileCart={() => setMobileCartOpen(false)}
                submitting={loading}
                isEdit={isEdit}
              />

              <section className={cardClass}>
                <label htmlFor="special-instructions" className="text-base font-semibold text-slate-900">
                  Special Instructions <span className="text-sm font-normal text-slate-400">(Optional)</span>
                </label>
                <textarea
                  id="special-instructions"
                  rows={3}
                  maxLength={INSTRUCTIONS_MAX}
                  className={`${fieldClass} mt-3`}
                  value={form.specialInstructions}
                  onChange={(e) => patchForm({ specialInstructions: e.target.value })}
                  placeholder="Add any special instructions for the kitchen..."
                />
                <p className="mt-1 text-right text-xs text-slate-400">
                  {form.specialInstructions.length}/{INSTRUCTIONS_MAX}
                </p>
              </section>
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
              onTaxPercentChange={patchTaxPercent}
              onServiceChargePercentChange={patchServiceChargePercent}
            />
          </div>

          {/* Bottom action bar */}
          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
            {submissionMessage || submissionError ? <p className="text-sm text-amber-800" role="status">{submissionMessage || submissionError}</p> : null}
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="min-h-11 w-full rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-600/30 disabled:opacity-60 sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="min-h-11 w-full rounded-xl bg-brand-700 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 focus:outline-none focus:ring-2 focus:ring-brand-600/40 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
            >
              {loading ? (isEdit ? "Updating Order..." : "Creating Order...") : isEdit ? "Update Order" : "Create Order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateOrderModal;
