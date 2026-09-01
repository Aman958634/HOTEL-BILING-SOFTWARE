import { memo } from "react";
import { FiEdit2, FiPlus, FiSearch, FiUser, FiX } from "react-icons/fi";
import { cardClass, fieldClass, labelClass } from "./constants";

const CustomerSection = ({
  customer,
  customerSearch,
  customerResults,
  customerSearching,
  showCustomerForm,
  customerForm,
  savingCustomer,
  errors,
  onSearchChange,
  onSelectCustomer,
  onClearCustomer,
  onOpenAddForm,
  onOpenEditForm,
  onCloseForm,
  onFormChange,
  onSaveCustomer,
}) => (
  <section className={cardClass}>
    <div className="mb-4 flex items-center justify-between gap-2">
      <h3 className="text-base font-semibold text-slate-900">Customer</h3>
      {!customer && !showCustomerForm ? (
        <button
          type="button"
          onClick={onOpenAddForm}
          className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-800 transition hover:bg-brand-100 focus:outline-none focus:ring-2 focus:ring-brand-600/30"
        >
          <FiPlus className="h-3.5 w-3.5" aria-hidden="true" />
          Add Customer
        </button>
      ) : null}
    </div>

    {customer && !showCustomerForm ? (
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-brand-800">
              <FiUser className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="font-semibold text-slate-900">{customer.fullName}</p>
              <p className="mt-0.5 text-sm text-slate-600">{customer.phone || "—"}</p>
              <p className="text-sm text-slate-500">{customer.email || "—"}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onOpenEditForm}
              aria-label="Edit customer"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-600/30"
            >
              <FiEdit2 className="h-3.5 w-3.5" />
              Edit
            </button>
            <button
              type="button"
              onClick={onClearCustomer}
              aria-label="Remove customer"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
            >
              <FiX className="h-3.5 w-3.5" />
              Clear
            </button>
          </div>
        </div>
      </div>
    ) : showCustomerForm ? (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {customer ? "Update Customer" : "New Customer"}
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="customer-fullName" className={labelClass}>Full Name *</label>
            <input
              id="customer-fullName"
              className={fieldClass}
              value={customerForm.fullName}
              onChange={(e) => onFormChange({ fullName: e.target.value })}
              placeholder="Customer name"
            />
          </div>
          <div>
            <label htmlFor="customer-email" className={labelClass}>Email</label>
            <input
              id="customer-email"
              type="email"
              className={fieldClass}
              value={customerForm.email}
              onChange={(e) => onFormChange({ email: e.target.value })}
              placeholder="email@example.com"
            />
          </div>
          <div>
            <label htmlFor="customer-phone" className={labelClass}>Phone</label>
            <input
              id="customer-phone"
              className={fieldClass}
              value={customerForm.phone}
              onChange={(e) => onFormChange({ phone: e.target.value })}
              placeholder="Phone number"
            />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onSaveCustomer}
            disabled={savingCustomer}
            className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-60"
          >
            {savingCustomer ? "Saving..." : "Save Customer"}
          </button>
          <button type="button" onClick={onCloseForm} className="rounded-xl border border-slate-300 px-4 py-2 text-sm text-slate-700">
            Cancel
          </button>
        </div>
      </div>
    ) : (
      <div>
        <label htmlFor="customer-search" className={labelClass}>Search Customer</label>
        <div className="relative">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="customer-search"
            type="search"
            className={`${fieldClass} pl-10`}
            value={customerSearch}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by name, phone or email..."
            aria-describedby={errors.customer ? "customer-error" : undefined}
          />
        </div>
        {customerSearching ? (
          <p className="mt-2 text-xs text-slate-500">Searching customers...</p>
        ) : null}
        {customerResults.length > 0 ? (
          <ul className="mt-2 max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-sm">
            {customerResults.map((entry) => (
              <li key={entry._id}>
                <button
                  type="button"
                  onClick={() => onSelectCustomer(entry)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                >
                  <FiUser className="h-4 w-4 shrink-0 text-brand-700" />
                  <span>
                    <span className="block text-sm font-medium text-slate-900">{entry.fullName}</span>
                    <span className="block text-xs text-slate-500">
                      {[entry.phone, entry.email].filter(Boolean).join(" · ") || "No contact"}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : customerSearch.trim().length >= 2 && !customerSearching ? (
          <p className="mt-2 text-xs text-slate-500">No customers found.</p>
        ) : (
          <p className="mt-2 text-xs text-slate-400">Optional — walk-in orders can proceed without a customer.</p>
        )}
        {errors.customer ? <p id="customer-error" className="mt-1 text-xs text-rose-600">{errors.customer}</p> : null}
      </div>
    )}
  </section>
);

export default memo(CustomerSection);
