import { useMemo, useState } from "react";
import { currency } from "../../../utils/format";

const OrderItemsSelector = ({ menuItems, categories, selectedItems, onChange }) => {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");

  const filtered = useMemo(() => {
    return menuItems.filter((item) => {
      const bySearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
      const byCategory = !category || (item.category?._id || item.category) === category;
      return bySearch && byCategory;
    });
  }, [menuItems, search, category]);

  const addItem = (item) => {
    const exists = selectedItems.find((entry) => String(entry.menuItem) === String(item._id));
    if (exists) {
      onChange(
        selectedItems.map((entry) =>
          String(entry.menuItem) === String(item._id)
            ? { ...entry, quantity: entry.quantity + 1 }
            : entry
        )
      );
      return;
    }

    onChange([
      ...selectedItems,
      {
        menuItem: item._id,
        name: item.name,
        price: item.price,
        quantity: 1,
        specialInstructions: "",
      },
    ]);
  };

  const updateQty = (id, diff) => {
    onChange(
      selectedItems
        .map((entry) =>
          String(entry.menuItem) === String(id)
            ? { ...entry, quantity: Math.max(1, entry.quantity + diff) }
            : entry
        )
    );
  };

  const removeItem = (id) => onChange(selectedItems.filter((entry) => String(entry.menuItem) !== String(id)));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-200 p-3">
        <div className="mb-3 grid gap-2 sm:grid-cols-2">
          <input className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Search food" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((cat) => <option key={cat._id} value={cat._id}>{cat.name}</option>)}
          </select>
        </div>

        <div className="max-h-64 space-y-2 overflow-y-auto">
          {filtered.map((item) => (
            <button key={item._id} type="button" onClick={() => addItem(item)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left hover:bg-slate-50">
              <p className="text-sm font-medium text-slate-800">{item.name}</p>
              <p className="text-xs text-slate-500">{currency(item.price)}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 p-3">
        <h4 className="text-sm font-semibold text-slate-800">Selected Items</h4>
        {!selectedItems.length ? (
          <p className="mt-2 text-xs text-slate-500">No items selected.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {selectedItems.map((item) => (
              <div key={item.menuItem} className="rounded-lg border border-slate-200 p-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{item.name}</p>
                    <p className="text-xs text-slate-500">{currency(item.price)} x {item.quantity}</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-900">{currency(item.price * item.quantity)}</p>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button type="button" onClick={() => updateQty(item.menuItem, -1)} className="rounded border border-slate-300 px-2">-</button>
                  <span className="min-w-6 text-center text-sm">{item.quantity}</span>
                  <button type="button" onClick={() => updateQty(item.menuItem, 1)} className="rounded border border-slate-300 px-2">+</button>
                  <button type="button" onClick={() => removeItem(item.menuItem)} className="ml-auto text-xs text-rose-600">Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderItemsSelector;
