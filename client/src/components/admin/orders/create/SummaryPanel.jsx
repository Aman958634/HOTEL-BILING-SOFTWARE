import { memo } from "react";
import { currency } from "../../../../utils/format";
import { NOTE_MAX, fieldClass, labelClass } from "./constants";

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
  <aside data-order-summary="true" className="min-w-0 border-t border-slate-200 bg-white lg:border-t-0 lg:border-l">
    <section className="space-y-3 px-4 py-3 sm:px-5 sm:py-3.5">
      <h3 className="text-base font-semibold text-slate-900">Order Summary</h3>

      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-slate-600">
          <span>Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"})</span>
          <span className="font-medium text-slate-900">{currency(totals.subtotal)}</span>
        </div>

        <div className="flex justify-between text-slate-600">
          <span>Discount{discountPercent ? ` (${discountPercent}%)` : ""}</span>
          <span className="font-medium text-rose-600">-{currency(totals.discount)}</span>
        </div>

        <div className="flex justify-between text-slate-600">
          <span>GST ({Number.isFinite(Number(taxPercent)) ? Number(taxPercent) : 0}%)</span>
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

        <div className="rounded-lg bg-slate-900 px-3 py-2.5 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">Grand Total</p>
          <div className="mt-0.5 flex items-baseline justify-between gap-3 text-xl font-bold">
            <span>{currency(totals.total)}</span>
            <span className="text-xs font-medium text-slate-300">{itemCount} {itemCount === 1 ? "item" : "items"}</span>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 pt-3">
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
