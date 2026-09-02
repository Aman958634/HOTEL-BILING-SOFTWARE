import { memo } from "react";
import { currency } from "../../../../utils/format";
import { NOTE_MAX, cardClass, fieldClass, labelClass } from "./constants";

const SummaryPanel = ({
  itemCount,
  totals,
  discountPercent,
  taxPercent,
  serviceChargePercent,
  orderType,
  notes,
  onNotesChange,
  onServiceChargePercentChange,
}) => (
  <aside className="hidden lg:sticky lg:top-4 lg:block lg:self-start">
    <section className={`${cardClass} space-y-4`}>
      <h3 className="text-base font-semibold text-slate-900">Order Summary</h3>

      <div className="space-y-2.5 text-sm">
        <div className="flex justify-between text-slate-600">
          <span>Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"})</span>
          <span className="font-medium text-slate-900">{currency(totals.subtotal)}</span>
        </div>

        <div className="flex justify-between text-slate-600">
          <span>Discount{discountPercent ? ` (${discountPercent}%)` : ""}</span>
          <span className="font-medium text-rose-600">-{currency(totals.discount)}</span>
        </div>

        <div className="flex justify-between text-slate-600">
          <span>GST ({taxPercent || 18}%)</span>
          <span className="font-medium text-slate-900">{currency(totals.tax)}</span>
        </div>

        <div>
          <label htmlFor="summary-service" className={labelClass}>Service Charge {serviceChargePercent ? `(${serviceChargePercent}%)` : ""}</label>
          <input
            id="summary-service"
            type="number"
            min="0"
            max="100"
            step="0.01"
            className={fieldClass}
            value={serviceChargePercent}
            onChange={(e) => onServiceChargePercentChange(e.target.value)}
            placeholder="0"
          />
        </div>
        <div className="flex justify-between text-slate-600">
          <span>Service Charge</span>
          <span className="font-medium text-slate-900">{currency(totals.serviceCharge)}</span>
        </div>

        {orderType === "DELIVERY" ? (
          <div className="flex justify-between text-slate-600">
            <span>Delivery Charge</span>
            <span className="font-medium text-slate-900">{currency(totals.deliveryCharge)}</span>
          </div>
        ) : null}

        <div className="rounded-xl bg-slate-900 px-3 py-3 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">Grand Total</p>
          <div className="mt-0.5 flex items-baseline justify-between gap-3 text-xl font-bold">
            <span>{currency(totals.total)}</span>
            <span className="text-xs font-medium text-slate-300">{itemCount} {itemCount === 1 ? "item" : "items"}</span>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-100 pt-4">
        <label htmlFor="customer-note" className={labelClass}>
          Customer Note <span className="font-normal text-slate-400">(Optional)</span>
        </label>
        <textarea
          id="customer-note"
          rows={3}
          maxLength={NOTE_MAX}
          className={fieldClass}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Add a note for this order..."
        />
        <p className="mt-1 text-right text-xs text-slate-400">{notes.length}/{NOTE_MAX}</p>
      </div>
    </section>
  </aside>
);

export default memo(SummaryPanel);
