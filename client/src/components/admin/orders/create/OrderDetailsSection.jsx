import { memo } from "react";
import { FiCalendar, FiClock, FiMinus, FiPlus } from "react-icons/fi";
import {
  ORDER_TYPES,
  TABLE_STATUS_STYLES,
  cardClass,
  fieldClass,
  labelClass,
} from "./constants";

const CREATE_ORDER_PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "CREDIT_CARD", label: "Card" },
  { value: "UPI", label: "Hotel UPI" },
];

const TableStatusBadge = ({ status }) => {
  const key = String(status || "AVAILABLE").toUpperCase();
  const meta = TABLE_STATUS_STYLES[key] || TABLE_STATUS_STYLES.AVAILABLE;
  return (
    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.className}`}>
      {meta.label}
    </span>
  );
};

const OrderDetailsSection = ({
  orderType,
  tableId,
  paymentMethod,
  paymentStatus,
  deliveryAddress,
  customer,
  guestCount,
  orderDateLabel,
  orderTimeLabel,
  tables,
  tablesLoading,
  isEdit,
  errors,
  onPatch,
  onGuestChange,
  isTableSelectable,
  hotelUpiCapability = { canCollect: false, reason: "Hotel UPI is unavailable." },
}) => (
  <section className={cardClass}>
    <h3 className="mb-4 text-base font-semibold text-slate-900">Order Details</h3>

    <p className={labelClass}>Order Type</p>
    <div className="grid gap-2 sm:grid-cols-3">
      {ORDER_TYPES.map(({ value, label, icon: Icon }) => {
        const active = orderType === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => onPatch({ orderType: value, table: value === "DINE_IN" ? tableId : "" })}
            className={`flex items-center gap-2.5 rounded-xl border px-3 py-3 text-left text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-brand-600/30 ${
              active
                ? "border-brand-600 bg-brand-50 text-brand-800 shadow-sm"
                : "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <span className={`rounded-lg p-2 ${active ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-500"}`}>
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            {label}
          </button>
        );
      })}
    </div>

    {orderType === "DINE_IN" ? (
      <div className="mt-5">
        <label htmlFor="order-table" className={labelClass}>Table</label>
        {tablesLoading ? (
          <p className="text-sm text-slate-500">Loading tables...</p>
        ) : (
          <>
            <select
              id="order-table"
              className={fieldClass}
              value={tableId}
              onChange={(e) => onPatch({ table: e.target.value })}
              aria-invalid={Boolean(errors.table)}
            >
              <option value="">Select Table</option>
              {tables.map((table) => {
                const selectable = isTableSelectable(table);
                const status = String(table.status || "AVAILABLE").toUpperCase();
                const activeCount = Number(table.activeOrderCount || 0);
                const countSuffix = activeCount > 0 ? ` · ${activeCount} active` : "";
                return (
                  <option key={table._id} value={table._id} disabled={!selectable}>
                    Table {table.tableNumber} · {table.capacity} seats · {TABLE_STATUS_STYLES[status]?.label || status}{countSuffix}
                  </option>
                );
              })}
            </select>
            {tableId ? (
              <div className="mt-2">
                <TableStatusBadge status={tables.find((t) => String(t._id) === String(tableId))?.status} />
              </div>
            ) : null}
            {errors.table ? <p className="mt-1 text-xs text-rose-600">{errors.table}</p> : null}
          </>
        )}
      </div>
    ) : null}

    <div className="mt-5 grid gap-4 sm:grid-cols-3">
      <div>
        <span className={labelClass}>Guests</span>
        <div className="inline-flex items-center rounded-xl border border-slate-200 bg-white">
          <button
            type="button"
            aria-label="Decrease guest count"
            onClick={() => onGuestChange(Math.max(1, guestCount - 1))}
            className="inline-flex h-10 w-10 items-center justify-center text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-600/30"
          >
            <FiMinus className="h-4 w-4" />
          </button>
          <span className="min-w-[2.5rem] text-center text-sm font-semibold text-slate-900">{guestCount}</span>
          <button
            type="button"
            aria-label="Increase guest count"
            onClick={() => onGuestChange(guestCount + 1)}
            className="inline-flex h-10 w-10 items-center justify-center text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-600/30"
          >
            <FiPlus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="order-date" className={labelClass}>
          <FiCalendar className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
          Order Date
        </label>
        <input id="order-date" readOnly value={orderDateLabel} className={`${fieldClass} bg-slate-50`} />
      </div>

      <div>
        <label htmlFor="order-time" className={labelClass}>
          <FiClock className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />
          Order Time
        </label>
        <input id="order-time" readOnly value={orderTimeLabel} className={`${fieldClass} bg-slate-50`} />
      </div>
    </div>

    {orderType === "DELIVERY" ? (
      <div className="mt-5 space-y-3 border-t border-slate-100 pt-5">
        <div>
          <label htmlFor="delivery-address" className={labelClass}>Delivery Address *</label>
          <textarea
            id="delivery-address"
            rows={2}
            className={fieldClass}
            value={deliveryAddress}
            onChange={(e) => onPatch({ deliveryAddress: e.target.value })}
            placeholder="Street, area, city..."
          />
          {customer?.phone ? (
            <p className="mt-1 text-xs text-slate-500">Delivery phone: {customer.phone}</p>
          ) : null}
          {errors.deliveryAddress ? <p className="mt-1 text-xs text-rose-600">{errors.deliveryAddress}</p> : null}
        </div>
        <div>
          <label htmlFor="delivery-charge" className={labelClass}>Delivery Charge</label>
          <input
            id="delivery-charge"
            type="number"
            min="0"
            step="0.01"
            className={fieldClass}
            value={form.deliveryCharge}
            onChange={(e) => onPatch({ deliveryCharge: e.target.value })}
          />
        </div>
      </div>
    ) : null}

    <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
      <div>
        <label htmlFor="payment-method" className={labelClass}>Payment Method</label>
        <select
          id="payment-method"
          className={fieldClass}
          value={paymentMethod}
          onChange={(e) => onPatch({ paymentMethod: e.target.value })}
        >
          {CREATE_ORDER_PAYMENT_METHODS.map((m) => (
            <option key={m.value} value={m.value} disabled={m.value === "UPI" && !hotelUpiCapability.canCollect}>{m.label}</option>
          ))}
        </select>
        {!hotelUpiCapability.canCollect ? <p className="mt-1 text-xs text-amber-700">{hotelUpiCapability.reason || "Hotel UPI is unavailable."}</p> : null}
      </div>
      <div>
        <p className={labelClass}>Payment Status</p>
        <output
          aria-label="Payment status"
          className="flex min-h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700"
        >
          {isEdit ? String(paymentStatus || "PENDING").replaceAll("_", " ") : "PENDING"}
        </output>
        {!isEdit ? <p className="mt-1 text-xs text-slate-500">Payment status updates after payment is collected.</p> : null}
      </div>
    </div>
  </section>
);

export default memo(OrderDetailsSection);
