import { memo } from "react";
import { FiMinus, FiPlus, FiSearch, FiTrash2 } from "react-icons/fi";
import { currency } from "../../../../utils/format";
import { cardClass, fieldClass, labelClass } from "./constants";

const ItemsSection = ({
  menuSearch,
  menuCategory,
  categories,
  filteredMenuItems,
  menuLoading,
  items,
  errors,
  discountPercent,
  onMenuSearchChange,
  onCategoryChange,
  onAddItem,
  onUpdateQty,
  onRemoveItem,
  onDiscountPercentChange,
  getCategoryName,
}) => (
  <>
    <section className={cardClass}>
      <h3 className="mb-4 text-base font-semibold text-slate-900">Add Items</h3>

      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <div className="relative">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            aria-label="Search food items"
            className={`${fieldClass} pl-10`}
            value={menuSearch}
            onChange={(e) => onMenuSearchChange(e.target.value)}
            placeholder="Search food items..."
          />
        </div>
        <select
          aria-label="Filter by category"
          className={fieldClass}
          value={menuCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat._id} value={cat._id}>{cat.name}</option>
          ))}
        </select>
      </div>

      {menuLoading ? (
        <p className="mt-3 text-sm text-slate-500">Loading menu items...</p>
      ) : (
        <div className="mt-3 max-h-36 space-y-1.5 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50/60 p-2">
          {filteredMenuItems.length ? (
            filteredMenuItems.slice(0, 15).map((item) => (
              <button
                key={item._id}
                type="button"
                onClick={() => onAddItem(item)}
                className="flex w-full items-center gap-3 rounded-lg border border-transparent bg-white px-2 py-2 text-left transition hover:border-brand-200 hover:bg-brand-50/40 focus:outline-none focus:ring-2 focus:ring-brand-600/20"
              >
                {item.image ? (
                  <img src={item.image} alt="" className="h-9 w-9 rounded-lg object-cover" />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-400">
                    {item.name?.charAt(0) || "?"}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-slate-900">{item.name}</span>
                  <span className="block text-xs text-slate-500">{currency(item.price)}</span>
                </span>
                <FiPlus className="h-4 w-4 shrink-0 text-brand-700" aria-hidden="true" />
              </button>
            ))
          ) : (
            <p className="py-4 text-center text-sm text-slate-500">No menu items found.</p>
          )}
        </div>
      )}

      {errors.items ? <p className="mt-2 text-xs text-rose-600">{errors.items}</p> : null}

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
        <table className="min-w-[640px] w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2.5">Item</th>
              <th className="hidden px-3 py-2.5 sm:table-cell">Category</th>
              <th className="px-3 py-2.5">Price</th>
              <th className="px-3 py-2.5">Qty</th>
              <th className="hidden px-3 py-2.5 md:table-cell">Discount</th>
              <th className="px-3 py-2.5">Total</th>
              <th className="px-3 py-2.5"><span className="sr-only">Action</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length ? (
              items.map((item) => {
                const lineTotal = item.price * item.quantity;
                return (
                  <tr key={item.menuItem} className="bg-white">
                    <td className="px-3 py-3">
                      <div className="flex items-start gap-2.5">
                        {item.image ? (
                          <img src={item.image} alt="" className="h-10 w-10 rounded-lg object-cover" />
                        ) : (
                          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
                            {item.name?.charAt(0) || "?"}
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900">{item.name}</p>
                          {item.description ? (
                            <p className="line-clamp-1 text-xs text-slate-500">{item.description}</p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-3 py-3 sm:table-cell">
                      <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                        {getCategoryName(item)}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-700">{currency(item.price)}</td>
                    <td className="px-3 py-3">
                      <div className="inline-flex items-center rounded-lg border border-slate-200">
                        <button
                          type="button"
                          aria-label={`Decrease ${item.name} quantity`}
                          onClick={() => onUpdateQty(item.menuItem, -1)}
                          className="p-1.5 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-600/30"
                        >
                          <FiMinus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-[1.75rem] text-center text-sm font-medium">{item.quantity}</span>
                        <button
                          type="button"
                          aria-label={`Increase ${item.name} quantity`}
                          onClick={() => onUpdateQty(item.menuItem, 1)}
                          className="p-1.5 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-600/30"
                        >
                          <FiPlus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="hidden px-3 py-3 text-slate-400 md:table-cell">0%</td>
                    <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-900">{currency(lineTotal)}</td>
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        aria-label={`Delete ${item.name}`}
                        onClick={() => onRemoveItem(item.menuItem)}
                        className="rounded-lg p-2 text-rose-600 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                      >
                        <FiTrash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-sm text-slate-500">
                  No items added. Search and add from the menu above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <label htmlFor="discount-percent" className="text-xs font-medium text-slate-600">Discount</label>
        <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1">
          <input
            id="discount-percent"
            type="number"
            min="0"
            max="100"
            step="0.01"
            className="w-14 border-0 bg-transparent text-sm text-slate-900 outline-none focus:ring-0"
            value={discountPercent}
            onChange={(e) => onDiscountPercentChange(e.target.value)}
            aria-label="Discount percentage"
          />
          <span className="text-sm text-slate-500">%</span>
        </div>
      </div>
    </section>
  </>
);

export default memo(ItemsSection);
