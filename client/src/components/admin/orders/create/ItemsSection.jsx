import { memo, useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { FiMinus, FiPlus, FiSearch, FiTrash2, FiX } from "react-icons/fi";
import { currency } from "../../../../utils/format";
import { useKeyboardShortcutScope } from "../../../../context/useKeyboardShortcutScope";
import { cardClass, fieldClass } from "./constants";

const QuantityControl = memo(({ item, onUpdateQty }) => (
  <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white">
    <button type="button" aria-label={`Decrease ${item.name} quantity`} onClick={() => onUpdateQty(item.menuItem, -1)} className="inline-flex h-10 w-10 items-center justify-center hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-600/30"><FiMinus className="h-3.5 w-3.5" /></button>
    <span className="min-w-9 text-center text-sm font-semibold text-slate-900">{item.quantity}</span>
    <button type="button" aria-label={`Increase ${item.name} quantity`} onClick={() => onUpdateQty(item.menuItem, 1)} className="inline-flex h-10 w-10 items-center justify-center hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-600/30"><FiPlus className="h-3.5 w-3.5" /></button>
  </div>
));

const SelectedOrderRow = memo(({ item, onUpdateQty, onRemoveItem, selected, onSelect }) => (
  <tr onClick={onSelect} className={selected ? "bg-brand-50/70" : "bg-white"}>
    <td className="px-3 py-3"><p className="font-medium text-slate-900">{item.name}</p>{item.description ? <p className="line-clamp-1 text-xs text-slate-500">{item.description}</p> : null}</td>
    <td className="px-3 py-3 text-xs text-slate-600">{item.categoryName || "—"}</td>
    <td className="whitespace-nowrap px-3 py-3 text-slate-700">{currency(item.price)}</td>
    <td className="px-3 py-3"><QuantityControl item={item} onUpdateQty={onUpdateQty} /></td>
    <td className="whitespace-nowrap px-3 py-3 font-semibold text-slate-900">{currency(item.price * item.quantity)}</td>
    <td className="px-3 py-3"><button type="button" aria-label={`Remove ${item.name}`} onClick={() => onRemoveItem(item.menuItem)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50"><FiTrash2 className="h-4 w-4" /></button></td>
  </tr>
));
const SelectedOrderCard = memo(({ item, onUpdateQty, onRemoveItem }) => (
  <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{item.name}</p><p className="mt-0.5 truncate text-xs text-slate-500">{item.categoryName || "Uncategorised"} · {currency(item.price)} each</p></div>
      <p className="shrink-0 text-sm font-bold text-slate-900">{currency(item.price * item.quantity)}</p>
    </div>
    <div className="mt-3 flex items-center gap-2">
      <QuantityControl item={item} onUpdateQty={onUpdateQty} />
      <button type="button" aria-label={`Remove ${item.name}`} onClick={() => onRemoveItem(item.menuItem)} className="ml-auto inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-rose-700 hover:bg-rose-50"><FiTrash2 className="h-4 w-4" />Remove</button>
    </div>
  </article>
));

const MenuResults = memo(({ loading, items, visibleCount, onAddItem, onShowMore, activeIndex, onActiveIndex, emptyMessage }) => {
  if (loading) return <p className="mt-3 text-sm text-slate-500">Loading menu items...</p>;

  return <>
    <div className="mt-3 grid grid-cols-1 gap-1.5 rounded-xl border border-slate-100 bg-slate-50/60 p-2 max-h-72 overflow-y-auto md:grid-cols-2 md:gap-2">
      {items.length ? items.slice(0, visibleCount).map((item, index) => (
        <button key={item._id} type="button" onMouseEnter={() => onActiveIndex(index)} onFocus={() => onActiveIndex(index)} onClick={() => onAddItem(item)} className={`flex min-h-12 w-full items-center gap-3 rounded-lg border bg-white px-2 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-brand-600/20 ${activeIndex === index ? "border-brand-400 bg-brand-50/60" : "border-transparent hover:border-brand-200 hover:bg-brand-50/40"}`}>
          {item.image ? <img src={item.image} alt="" className="h-9 w-9 rounded-lg object-cover" /> : <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-400">{item.name?.charAt(0) || "?"}</span>}
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-900">{item.name}</span><span className="block text-xs text-slate-500">{currency(item.price)}</span></span>
          <span className="inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-lg bg-brand-50 px-2 text-xs font-semibold text-brand-700"><FiPlus className="h-4 w-4" /><span>Add</span></span>
        </button>
      )) : <p className="col-span-full py-4 text-center text-sm text-slate-500">{emptyMessage}</p>}
    </div>
    {items.length > visibleCount ? <button type="button" onClick={onShowMore} className="mt-2 min-h-10 w-full rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50">Show more ({items.length - visibleCount} remaining)</button> : null}
  </>;
});
const ItemsSection = ({ menuItems = [], categories = [], menuLoading, items, errors, discountPercent, onAddItem, onUpdateQty, onRemoveItem, onDiscountPercentChange, menuSearchRef }) => {
  const [menuSearch, setMenuSearch] = useState("");
  const [menuCategory, setMenuCategory] = useState("");
  const [visibleCount, setVisibleCount] = useState(60);
  const [activeMenuIndex, setActiveMenuIndex] = useState(0);
  const [selectedCartItem, setSelectedCartItem] = useState("");
  const deferredMenuSearch = useDeferredValue(menuSearch);
  const handleMenuCategoryChange = useCallback((categoryId) => {
    setMenuCategory(categoryId);
    // A prior menu-name search must not make a newly selected category look empty.
    setMenuSearch("");
  }, []);
  const selectedCategory = categories.find((category) => String(category._id) === String(menuCategory));

  const filteredMenuItems = useMemo(() => {
    const query = deferredMenuSearch.trim().toLowerCase();
    return menuItems.filter((item) => {
      const matchesSearch = !query || item.name?.toLowerCase().includes(query) || item.description?.toLowerCase().includes(query);
      const categoryId = item.category?._id || item.category;
      const matchesCategory = !menuCategory || String(categoryId) === String(menuCategory);
      const available = item.isAvailable ?? item.available ?? true;
      return matchesSearch && matchesCategory && available;
    });
  }, [deferredMenuSearch, menuCategory, menuItems]);

  useEffect(() => setVisibleCount(60), [menuSearch, menuCategory]);
  useEffect(() => setActiveMenuIndex((index) => Math.max(0, Math.min(index, Math.max(0, filteredMenuItems.length - 1)))), [filteredMenuItems.length]);
  useEffect(() => setSelectedCartItem((current) => items.some((item) => String(item.menuItem) === String(current)) ? current : (items.at(-1)?.menuItem || "")), [items]);
  const showMoreMenuItems = useCallback(() => setVisibleCount((count) => count + 60), []);
  const visibleMenuItems = filteredMenuItems.slice(0, visibleCount);
  const addActiveMenuItem = useCallback(() => {
    const item = visibleMenuItems[activeMenuIndex];
    if (!item) return false;
    onAddItem(item);
  }, [activeMenuIndex, onAddItem, visibleMenuItems]);
  const selectedItem = items.find((item) => String(item.menuItem) === String(selectedCartItem)) || items.at(-1);

  useKeyboardShortcutScope({
    f5: { allowInEditable: true, handler: () => { menuSearchRef.current?.focus(); } },
    f6: { allowInEditable: true, handler: addActiveMenuItem },
    arrowdown: { allowInEditable: true, handler: (event) => { if (event.target !== menuSearchRef.current && event.target?.tagName) return false; if (!visibleMenuItems.length) return false; setActiveMenuIndex((index) => Math.min(index + 1, visibleMenuItems.length - 1)); } },
    arrowup: { allowInEditable: true, handler: (event) => { if (event.target !== menuSearchRef.current && event.target?.tagName) return false; if (!visibleMenuItems.length) return false; setActiveMenuIndex((index) => Math.max(index - 1, 0)); } },
    enter: { allowInEditable: true, handler: (event) => { if (event.target !== menuSearchRef.current && event.target?.tagName) return false; return addActiveMenuItem(); } },
    plus: { handler: () => { if (!selectedItem) return false; onUpdateQty(selectedItem.menuItem, 1); } },
    minus: { handler: () => { if (!selectedItem) return false; onUpdateQty(selectedItem.menuItem, -1); } },
    delete: { handler: () => { if (!selectedItem) return false; onRemoveItem(selectedItem.menuItem); } },
  }, { priority: 120 });

  return <>
    <section className={cardClass}>
      <div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="text-base font-semibold text-slate-900">Menu</h3><p className="text-xs text-slate-500">Search or tap an item to add it.</p></div>{items.length ? <span className="rounded-full bg-brand-50 px-2 py-1 text-xs font-semibold text-brand-800">{items.length} selected</span> : null}</div>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_180px]">
        <div className="relative"><FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input ref={menuSearchRef} type="search" aria-label="Search food items" className={`${fieldClass} pl-10`} value={menuSearch} onChange={(event) => setMenuSearch(event.target.value)} placeholder="Search food items…" />{menuSearch ? <button type="button" onClick={() => setMenuSearch("")} aria-label="Clear menu search" className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"><FiX className="h-4 w-4" /></button> : null}</div>
        <select aria-label="Filter by category" className={fieldClass} value={menuCategory} onChange={(event) => handleMenuCategoryChange(event.target.value)}>
          <option value="">All Categories</option>
          {categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}
        </select>
      </div>
      <MenuResults loading={menuLoading} items={filteredMenuItems} visibleCount={visibleCount} onAddItem={onAddItem} onShowMore={showMoreMenuItems} activeIndex={activeMenuIndex} onActiveIndex={setActiveMenuIndex} emptyMessage={menuCategory ? `No available items in ${selectedCategory?.name || "this category"}.` : "No available menu items found."} />
      {errors.items ? <p className="mt-2 text-xs text-rose-600">{errors.items}</p> : null}
      <div className="mt-4 space-y-2 md:hidden">{items.length ? items.map((item) => <div key={item.menuItem} onClick={() => setSelectedCartItem(item.menuItem)} className={String(selectedItem?.menuItem) === String(item.menuItem) ? "rounded-xl ring-2 ring-brand-500/30" : "rounded-xl"}><SelectedOrderCard item={item} onUpdateQty={onUpdateQty} onRemoveItem={onRemoveItem} /></div>) : <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500">No items added. Search and add from the menu above.</p>}</div>
      <div className="mt-4 hidden overflow-x-auto rounded-xl border border-slate-200 md:block">
        <table className="min-w-[640px] w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2.5">Item</th><th className="px-3 py-2.5">Category</th><th className="px-3 py-2.5">Price</th><th className="px-3 py-2.5">Qty</th><th className="px-3 py-2.5">Total</th><th className="px-3 py-2.5"><span className="sr-only">Action</span></th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {items.length ? items.map((item) => <SelectedOrderRow key={item.menuItem} item={item} selected={String(selectedItem?.menuItem) === String(item.menuItem)} onSelect={() => setSelectedCartItem(item.menuItem)} onUpdateQty={onUpdateQty} onRemoveItem={onRemoveItem} />) : <tr><td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-500">No items added. Search and add from the menu above.</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center gap-2"><label htmlFor="discount-percent" className="text-xs font-medium text-slate-600">Discount</label><div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1"><input id="discount-percent" type="number" min="0" max="100" step="0.01" className="w-14 border-0 bg-transparent text-sm text-slate-900 outline-none focus:ring-0" value={discountPercent} onChange={(event) => onDiscountPercentChange(event.target.value)} aria-label="Discount percentage" /><span className="text-sm text-slate-500">%</span></div></div>
    </section>
  </>;
};

export default memo(ItemsSection);
