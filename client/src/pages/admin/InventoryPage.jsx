import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FiAlertTriangle, FiArchive, FiBox, FiCheckCircle, FiClock, FiList, FiPackage, FiPlus, FiRefreshCw, FiSave, FiSliders, FiX } from "react-icons/fi";
import EmptyState from "../../components/common/EmptyState";
import RequestState from "../../components/common/RequestState";
import { SkeletonCard, SkeletonList } from "../../components/common/Skeletons";
import { getAdminMenu } from "../../services/menuService";
import { createInventoryItem, createRecipe, adjustInventoryItem, getInventoryItems, getInventoryMovements, getRecipeCost, getRecipes } from "../../services/inventoryService";

const initialItem = { itemName: "", sku: "", unit: "kg", baseUnit: "kg", quantity: "", reorderLevel: "", costPerUnit: "" };
const initialRecipe = { food: "", name: "", status: "DRAFT", yieldQuantity: "1", ingredients: [{ inventoryItem: "", quantity: "", unit: "g" }] };
const fieldClass = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15";

const STATUS_META = {
  NORMAL: { label: "Healthy", className: "border-emerald-200 bg-emerald-50 text-emerald-800", icon: <FiCheckCircle aria-hidden="true" /> },
  LOW: { label: "Low stock", className: "border-amber-200 bg-amber-50 text-amber-800", icon: <FiAlertTriangle aria-hidden="true" /> },
  CRITICAL: { label: "Critical", className: "border-orange-200 bg-orange-50 text-orange-800", icon: <FiAlertTriangle aria-hidden="true" /> },
  OUT_OF_STOCK: { label: "Out of stock", className: "border-rose-200 bg-rose-50 text-rose-800", icon: <FiAlertTriangle aria-hidden="true" /> },
};

const quantityWithUnit = (quantity, unit) => `${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 }).format(Number(quantity || 0))} ${unit || "—"}`;
const dateLabel = (value) => value ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)) : "—";
const statusMeta = (status) => STATUS_META[status] || { label: status || "Unknown", className: "border-slate-200 bg-slate-50 text-slate-700", icon: <FiBox aria-hidden="true" /> };

const StatusBadge = ({ status }) => {
  const meta = statusMeta(status);
  return <span className={`ops-status-badge border ${meta.className}`}>{meta.icon}{meta.label}</span>;
};

const SummaryCard = ({ label, value, tone = "slate", icon }) => <article className="ops-card min-w-0 p-3 sm:p-4"><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><span className={tone === "amber" ? "text-amber-600" : tone === "rose" ? "text-rose-600" : tone === "emerald" ? "text-emerald-600" : "text-slate-500"}>{icon}</span></div><p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p></article>;

const InventoryPage = () => {
  const [items, setItems] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [itemForm, setItemForm] = useState(initialItem);
  const [recipeForm, setRecipeForm] = useState(initialRecipe);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [stockFilter, setStockFilter] = useState("ALL");
  const [adjustingItem, setAdjustingItem] = useState(null);
  const [adjustmentForm, setAdjustmentForm] = useState({ quantity: "", reason: "Manual stock adjustment" });
  const [movementItem, setMovementItem] = useState(null);
  const [movements, setMovements] = useState([]);
  const [movementLoading, setMovementLoading] = useState(false);
  const [recipeCosts, setRecipeCosts] = useState({});
  const [loadingRecipeCost, setLoadingRecipeCost] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [{ data: inventoryData }, { data: recipeData }, { data: foodData }] = await Promise.all([getInventoryItems(), getRecipes(), getAdminMenu({ limit: 200 })]);
      setItems(inventoryData.data || []);
      setRecipes(recipeData.data || []);
      setFoods(foodData.data || []);
    } catch (err) {
      const message = err?.response?.data?.message || "Unable to load inventory";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const visibleItems = useMemo(() => items.filter((item) => {
    const matchesSearch = `${item.itemName || ""} ${item.sku || ""}`.toLowerCase().includes(search.trim().toLowerCase());
    const matchesFilter = stockFilter === "ALL" || (stockFilter === "ATTENTION" ? item.status !== "NORMAL" : item.status === stockFilter);
    return matchesSearch && matchesFilter;
  }), [items, search, stockFilter]);

  const stockSummary = useMemo(() => ({
    total: items.length,
    low: items.filter((item) => ["LOW", "CRITICAL"].includes(item.status)).length,
    out: items.filter((item) => item.status === "OUT_OF_STOCK").length,
    healthy: items.filter((item) => item.status === "NORMAL").length,
  }), [items]);
  const attentionItems = useMemo(() => items.filter((item) => item.status !== "NORMAL"), [items]);

  const submitItem = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (/\d/.test(itemForm.unit)) { toast.error("Unit cannot contain numbers (e.g., use 'kg' not '10kg')"); return; }
      if (/\d/.test(itemForm.baseUnit)) { toast.error("Base unit cannot contain numbers (e.g., use 'kg' not '10kg')"); return; }
      await createInventoryItem({ ...itemForm, quantity: Number(itemForm.quantity || 0), reorderLevel: Number(itemForm.reorderLevel || 0), costPerUnit: Number(itemForm.costPerUnit || 0) });
      setItemForm(initialItem);
      toast.success("Inventory item created");
      await load();
    } catch (err) { toast.error(err?.response?.data?.message || "Unable to create inventory item"); }
    finally { setSaving(false); }
  };

  const openAdjustment = (item) => {
    setAdjustingItem(item);
    setAdjustmentForm({ quantity: "", reason: "Manual stock adjustment" });
  };

  const submitAdjustment = async (event) => {
    event.preventDefault();
    const value = Number(adjustmentForm.quantity);
    if (!Number.isFinite(value) || value === 0) { toast.error("Enter a non-zero stock adjustment"); return; }
    if (!adjustingItem) return;
    setSaving(true);
    try {
      await adjustInventoryItem(adjustingItem._id, { quantity: value, unit: adjustingItem.baseUnit || adjustingItem.unit, reason: adjustmentForm.reason || "Manual stock adjustment" });
      toast.success("Stock adjusted");
      setAdjustingItem(null);
      await load();
    } catch (err) { toast.error(err?.response?.data?.message || "Unable to adjust stock"); }
    finally { setSaving(false); }
  };

  const openMovements = async (item) => {
    setMovementItem(item);
    setMovements([]);
    setMovementLoading(true);
    try {
      const { data } = await getInventoryMovements(item._id);
      setMovements(data.data || []);
    } catch (err) { toast.error(err?.response?.data?.message || "Unable to load stock movements"); }
    finally { setMovementLoading(false); }
  };

  const submitRecipe = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await createRecipe({ ...recipeForm, yieldQuantity: Number(recipeForm.yieldQuantity || 1), ingredients: recipeForm.ingredients.map((line) => ({ ...line, quantity: Number(line.quantity) })) });
      setRecipeForm(initialRecipe);
      toast.success("Recipe saved");
      await load();
    } catch (err) { toast.error(err?.response?.data?.message || "Unable to save recipe"); }
    finally { setSaving(false); }
  };

  const updateIngredient = (index, patch) => setRecipeForm((current) => ({ ...current, ingredients: current.ingredients.map((line, lineIndex) => lineIndex === index ? { ...line, ...patch } : line) }));
  const removeIngredient = (index) => setRecipeForm((current) => ({ ...current, ingredients: current.ingredients.filter((_, lineIndex) => lineIndex !== index) }));

  const loadRecipeCost = async (recipe) => {
    if (recipeCosts[recipe._id]) return;
    setLoadingRecipeCost(recipe._id);
    try {
      const { data } = await getRecipeCost(recipe._id);
      setRecipeCosts((current) => ({ ...current, [recipe._id]: data.data }));
    } catch (err) { toast.error(err?.response?.data?.message || "Unable to load recipe cost"); }
    finally { setLoadingRecipeCost(""); }
  };

  return <div className="space-y-4 pb-20 sm:space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Inventory & Recipes</h2><p className="mt-1 max-w-2xl text-sm text-slate-500">See stock health first, then manage adjustments and recipe ingredient consumption.</p></div><button type="button" onClick={load} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm disabled:opacity-60"><FiRefreshCw aria-hidden="true" />Refresh</button></header>

    {error ? <RequestState message={error} onRetry={load} /> : loading ? <><div className="grid gap-3 grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index} className="h-28" />)}</div><SkeletonList count={5} /></> : <>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Inventory summary"><SummaryCard label="Total items" value={stockSummary.total} icon={<FiBox aria-hidden="true" />} /><SummaryCard label="Low stock" value={stockSummary.low} tone="amber" icon={<FiAlertTriangle aria-hidden="true" />} /><SummaryCard label="Out of stock" value={stockSummary.out} tone="rose" icon={<FiArchive aria-hidden="true" />} /><SummaryCard label="Healthy" value={stockSummary.healthy} tone="emerald" icon={<FiCheckCircle aria-hidden="true" />} /></section>

      {attentionItems.length ? <section className="ops-card p-3 sm:p-4" aria-labelledby="inventory-attention-title"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 id="inventory-attention-title" className="flex items-center gap-2 text-base font-bold text-slate-900"><FiAlertTriangle className="text-amber-500" aria-hidden="true" />Needs attention</h3><p className="mt-0.5 text-xs text-slate-500">Items using the existing inventory status rules.</p></div><span className="text-xs font-semibold text-slate-500">{attentionItems.length} item{attentionItems.length === 1 ? "" : "s"}</span></div><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{attentionItems.slice(0, 6).map((item) => <div key={item._id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{item.itemName}</p><p className="mt-0.5 text-xs text-slate-600">{quantityWithUnit(item.quantity, item.baseUnit || item.unit)} remaining · Minimum {quantityWithUnit(item.reorderLevel, item.baseUnit || item.unit)}</p></div><StatusBadge status={item.status} /></div>)}</div></section> : null}

      <section aria-labelledby="inventory-list-title"><div className="ops-filter-bar"><div className="flex flex-wrap items-end justify-between gap-3"><div className="min-w-0 flex-1"><label htmlFor="inventory-search" className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Search inventory</label><input id="inventory-search" value={search} onChange={(event) => setSearch(event.target.value)} className={fieldClass} placeholder="Search item or SKU" /></div><p className="pb-2 text-xs text-slate-500">{visibleItems.length} of {items.length} items</p></div><div className="ops-scroll-tabs mt-3" aria-label="Inventory filters">{[["ALL", "All"], ["ATTENTION", "Needs attention"], ["LOW", "Low stock"], ["CRITICAL", "Critical"], ["OUT_OF_STOCK", "Out of stock"], ["NORMAL", "Healthy"]].map(([value, label]) => <button key={value} type="button" onClick={() => setStockFilter(value)} className={`min-h-10 rounded-lg px-3 text-sm font-medium ${stockFilter === value ? "bg-brand-700 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{label}</button>)}</div></div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><div><h3 id="inventory-list-title" className="text-base font-bold text-slate-900">Stock on hand</h3><p className="mt-0.5 text-xs text-slate-500">Quantity is shown in each item’s stored stock unit.</p></div></div>
        {visibleItems.length === 0 ? <EmptyState icon={<FiBox className="h-10 w-10" />} title={items.length ? "No matching inventory items" : "No inventory items yet"} description={items.length ? "Try a different search or stock filter." : "Add inventory items to start tracking stock."} /> : <><div className="mt-3 grid gap-3 md:hidden">{visibleItems.map((item) => <article key={item._id} className="ops-card min-w-0 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h4 className="break-words text-base font-bold text-slate-900">{item.itemName}</h4><p className="mt-0.5 text-xs text-slate-500">SKU {item.sku}</p></div><StatusBadge status={item.status} /></div><div className="mt-3 grid grid-cols-2 gap-3"><div><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Current stock</p><p className="mt-1 text-xl font-bold text-slate-900">{quantityWithUnit(item.quantity, item.baseUnit || item.unit)}</p></div><div><p className="text-xs font-medium uppercase tracking-wide text-slate-500">Minimum</p><p className="mt-1 text-sm font-semibold text-slate-800">{quantityWithUnit(item.reorderLevel, item.baseUnit || item.unit)}</p><p className="mt-1 text-xs text-slate-500">Updated {dateLabel(item.updatedAt)}</p></div></div><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => openAdjustment(item)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-700 px-3 text-sm font-semibold text-white"><FiSliders aria-hidden="true" />Manage stock</button><button type="button" onClick={() => openMovements(item)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-700"><FiList aria-hidden="true" />Movements</button></div></article>)}</div><div className="mt-3 hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block"><table className="w-full min-w-[900px] text-sm"><thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr>{["Item", "SKU", "Current stock", "Unit", "Reorder", "Updated", "Status", "Actions"].map((heading) => <th key={heading} className="whitespace-nowrap px-4 py-3">{heading}</th>)}</tr></thead><tbody>{visibleItems.map((item) => <tr key={item._id} className="border-t border-slate-100 hover:bg-slate-50/70"><td className="px-4 py-3 font-semibold text-slate-900">{item.itemName}</td><td className="px-4 py-3 text-slate-600">{item.sku}</td><td className="px-4 py-3 font-semibold text-slate-900">{quantityWithUnit(item.quantity, item.baseUnit || item.unit)}</td><td className="px-4 py-3 text-slate-700">{item.baseUnit || item.unit}</td><td className="px-4 py-3 text-slate-700">{quantityWithUnit(item.reorderLevel, item.baseUnit || item.unit)}</td><td className="px-4 py-3 text-slate-600">{dateLabel(item.updatedAt)}</td><td className="px-4 py-3"><StatusBadge status={item.status} /></td><td className="px-4 py-3"><div className="flex items-center gap-2"><button type="button" onClick={() => openAdjustment(item)} className="inline-flex min-h-10 items-center gap-1 rounded-lg bg-brand-700 px-2.5 text-xs font-semibold text-white"><FiSliders aria-hidden="true" />Manage</button><button type="button" onClick={() => openMovements(item)} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-300 px-2.5 text-xs font-medium text-slate-700"><FiList aria-hidden="true" />History</button></div></td></tr>)}</tbody></table></div></>}</section>

      <section className="ops-card p-3 sm:p-4" aria-labelledby="add-inventory-title"><div className="mb-3"><h3 id="add-inventory-title" className="flex items-center gap-2 text-base font-bold text-slate-900"><FiPlus aria-hidden="true" />Add inventory item</h3><p className="mt-0.5 text-xs text-slate-500">Opening stock and its unit are saved separately.</p></div><form onSubmit={submitItem} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-sm font-medium text-slate-700">Item name<input className={`mt-1 ${fieldClass}`} required value={itemForm.itemName} onChange={(event) => setItemForm((current) => ({ ...current, itemName: event.target.value }))} /></label><label className="text-sm font-medium text-slate-700">SKU<input className={`mt-1 ${fieldClass}`} required value={itemForm.sku} onChange={(event) => setItemForm((current) => ({ ...current, sku: event.target.value }))} /></label><label className="text-sm font-medium text-slate-700">Stock unit<input className={`mt-1 ${fieldClass}`} required value={itemForm.unit} onChange={(event) => setItemForm((current) => ({ ...current, unit: event.target.value }))} /></label><label className="text-sm font-medium text-slate-700">Base unit<input className={`mt-1 ${fieldClass}`} value={itemForm.baseUnit} onChange={(event) => setItemForm((current) => ({ ...current, baseUnit: event.target.value }))} /></label><label className="text-sm font-medium text-slate-700">Opening quantity<div className="mt-1 grid grid-cols-[minmax(0,1fr)_5rem] gap-2"><input className={fieldClass} type="number" min="0" step="any" value={itemForm.quantity} onChange={(event) => setItemForm((current) => ({ ...current, quantity: event.target.value }))} /><span className="flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">{itemForm.unit || "unit"}</span></div></label><label className="text-sm font-medium text-slate-700">Reorder quantity<div className="mt-1 grid grid-cols-[minmax(0,1fr)_5rem] gap-2"><input className={fieldClass} type="number" min="0" step="any" value={itemForm.reorderLevel} onChange={(event) => setItemForm((current) => ({ ...current, reorderLevel: event.target.value }))} /><span className="flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">{itemForm.baseUnit || itemForm.unit || "unit"}</span></div></label><label className="text-sm font-medium text-slate-700">Cost per base unit<input className={`mt-1 ${fieldClass}`} type="number" min="0" step="any" value={itemForm.costPerUnit} onChange={(event) => setItemForm((current) => ({ ...current, costPerUnit: event.target.value }))} /></label><button disabled={saving} className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white disabled:opacity-60"><FiSave aria-hidden="true" />Save item</button></form></section>

      <section className="ops-card p-3 sm:p-4" aria-labelledby="recipe-form-title"><div className="mb-3"><h3 id="recipe-form-title" className="text-base font-bold text-slate-900">Create recipe</h3><p className="mt-0.5 text-xs text-slate-500">Link a menu item to its existing inventory ingredients and consumption units.</p></div><form onSubmit={submitRecipe} className="space-y-3"><div className="grid gap-3 sm:grid-cols-3"><label className="text-sm font-medium text-slate-700">Menu item<select className={`mt-1 ${fieldClass}`} required value={recipeForm.food} onChange={(event) => setRecipeForm((current) => ({ ...current, food: event.target.value }))}><option value="">Select menu item</option>{foods.map((food) => <option key={food._id} value={food._id}>{food.name}</option>)}</select></label><label className="text-sm font-medium text-slate-700">Recipe name<input className={`mt-1 ${fieldClass}`} required value={recipeForm.name} onChange={(event) => setRecipeForm((current) => ({ ...current, name: event.target.value }))} /></label><label className="text-sm font-medium text-slate-700">Yield portions<input className={`mt-1 ${fieldClass}`} required type="number" min="1" step="any" value={recipeForm.yieldQuantity} onChange={(event) => setRecipeForm((current) => ({ ...current, yieldQuantity: event.target.value }))} /></label></div><fieldset className="rounded-xl border border-slate-200 p-3"><legend className="px-1 text-sm font-semibold text-slate-800">Ingredients</legend><div className="mt-1 space-y-2">{recipeForm.ingredients.map((line, index) => <div key={index} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_8rem_auto]"><label className="sr-only" htmlFor={`ingredient-${index}`}>Ingredient {index + 1}</label><select id={`ingredient-${index}`} className={fieldClass} required value={line.inventoryItem} onChange={(event) => updateIngredient(index, { inventoryItem: event.target.value })}><option value="">Select ingredient</option>{items.map((item) => <option key={item._id} value={item._id}>{item.itemName} ({item.baseUnit || item.unit})</option>)}</select><label className="grid grid-cols-[minmax(0,1fr)_4rem] items-center gap-2"><span className="sr-only">Quantity</span><input className={fieldClass} required type="number" min="0" step="any" placeholder="Quantity" value={line.quantity} onChange={(event) => updateIngredient(index, { quantity: event.target.value })} /><span className="text-xs font-semibold text-slate-500">qty</span></label><label><span className="sr-only">Consumption unit</span><input className={fieldClass} required placeholder="Unit" value={line.unit} onChange={(event) => updateIngredient(index, { unit: event.target.value })} /></label><button type="button" onClick={() => removeIngredient(index)} disabled={recipeForm.ingredients.length === 1} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-rose-200 px-3 text-sm font-medium text-rose-700 disabled:cursor-not-allowed disabled:opacity-50" aria-label={`Remove ingredient ${index + 1}`}>Remove</button></div>)}</div><button type="button" onClick={() => setRecipeForm((current) => ({ ...current, ingredients: [...current.ingredients, { inventoryItem: "", quantity: "", unit: "g" }] }))} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-700"><FiPlus aria-hidden="true" />Add ingredient</button></fieldset><button disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white disabled:opacity-60"><FiSave aria-hidden="true" />Save recipe</button></form></section>

      <section aria-labelledby="recipes-title"><div className="mb-3"><h3 id="recipes-title" className="text-base font-bold text-slate-900">Recipes</h3><p className="mt-0.5 text-xs text-slate-500">Ingredient consumption uses each recipe’s stored quantity and unit.</p></div>{recipes.length === 0 ? <EmptyState title="No recipes configured yet" description="Create a recipe to connect menu items to stock consumption." /> : <div className="grid gap-3 lg:grid-cols-2">{recipes.map((recipe) => <article key={recipe._id} className="ops-card min-w-0 p-3 sm:p-4"><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><h4 className="break-words text-base font-bold text-slate-900">{recipe.name}</h4><p className="mt-0.5 text-sm text-slate-500">{recipe.food?.name || "Menu item"} · {recipe.ingredients?.length || 0} ingredients · Yield {recipe.yieldQuantity || 1}</p></div><span className="ops-status-badge border border-slate-200 bg-slate-50 text-slate-700">v{recipe.version} · {recipe.status}</span></div><ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-100">{(recipe.ingredients || []).map((line) => <li key={line._id || line.inventoryItem?._id} className="flex min-w-0 items-center justify-between gap-3 px-3 py-2 text-sm"><span className="min-w-0 truncate font-medium text-slate-800">{line.inventoryItem?.itemName || "Inventory item"}</span><strong className="shrink-0 text-slate-900">{quantityWithUnit(line.quantity, line.unit)}</strong></li>)}</ul><div className="mt-3 flex flex-wrap items-center justify-between gap-2">{recipeCosts[recipe._id] ? <p className="text-sm text-slate-600">Estimated cost <strong className="text-slate-900">₹{Number(recipeCosts[recipe._id]?.totalCost || 0).toFixed(2)}</strong></p> : <p className="text-xs text-slate-500">Costing uses existing recipe calculation.</p>}<button type="button" onClick={() => loadRecipeCost(recipe)} disabled={loadingRecipeCost === recipe._id || Boolean(recipeCosts[recipe._id])} className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 disabled:opacity-60">{loadingRecipeCost === recipe._id ? "Loading…" : recipeCosts[recipe._id] ? "Cost loaded" : "Show estimated cost"}</button></div></article>)}</div>}</section>
    </>}

    {adjustingItem ? <div className="ui-modal-backdrop" role="presentation"><section className="ui-modal max-w-lg" role="dialog" aria-modal="true" aria-labelledby="adjust-stock-title"><div className="flex items-start justify-between gap-3"><div><h3 id="adjust-stock-title" className="text-lg font-bold text-slate-900">Manage stock</h3><p className="mt-1 text-sm text-slate-500">{adjustingItem.itemName} · Current stock <strong className="text-slate-800">{quantityWithUnit(adjustingItem.quantity, adjustingItem.baseUnit || adjustingItem.unit)}</strong></p></div><button type="button" onClick={() => setAdjustingItem(null)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-300 text-slate-600" aria-label="Close stock adjustment"><FiX aria-hidden="true" /></button></div><form onSubmit={submitAdjustment} className="mt-4 space-y-3"><label className="text-sm font-medium text-slate-700">Adjustment quantity<div className="mt-1 grid grid-cols-[minmax(0,1fr)_5rem] gap-2"><input className={fieldClass} autoFocus type="number" step="any" placeholder="Use + or −" value={adjustmentForm.quantity} onChange={(event) => setAdjustmentForm((current) => ({ ...current, quantity: event.target.value }))} /><span className="flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">{adjustingItem.baseUnit || adjustingItem.unit}</span></div><span className="mt-1 block text-xs text-slate-500">Use a positive number to add stock or a negative number to reduce it.</span></label><label className="text-sm font-medium text-slate-700">Reason<input className={`mt-1 ${fieldClass}`} value={adjustmentForm.reason} onChange={(event) => setAdjustmentForm((current) => ({ ...current, reason: event.target.value }))} /></label><div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setAdjustingItem(null)} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-700">Cancel</button><button disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white disabled:opacity-60"><FiSave aria-hidden="true" />Apply adjustment</button></div></form></section></div> : null}

    {movementItem ? <div className="ui-modal-backdrop" role="presentation"><section className="ui-modal max-w-2xl" role="dialog" aria-modal="true" aria-labelledby="movement-history-title"><div className="flex items-start justify-between gap-3"><div><h3 id="movement-history-title" className="text-lg font-bold text-slate-900">Stock movement</h3><p className="mt-1 text-sm text-slate-500">{movementItem.itemName} · Current stock {quantityWithUnit(movementItem.quantity, movementItem.baseUnit || movementItem.unit)}</p></div><button type="button" onClick={() => setMovementItem(null)} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-slate-300 text-slate-600" aria-label="Close stock movement"><FiX aria-hidden="true" /></button></div><div className="mt-4 max-h-[60dvh] space-y-2 overflow-y-auto pr-1">{movementLoading ? <SkeletonList count={4} className="h-16" /> : movements.length === 0 ? <EmptyState icon={<FiClock className="h-8 w-8" />} title="No stock movements yet" description="Movements will appear here when this item is adjusted or consumed." /> : movements.map((movement) => <div key={movement._id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2.5"><div className="min-w-0"><p className="text-sm font-semibold text-slate-900">{movement.movementType?.replaceAll("_", " ") || "Stock movement"}</p><p className="mt-0.5 truncate text-xs text-slate-500">{movement.reason || "—"} · {dateLabel(movement.createdAt)}</p></div><strong className={Number(movement.quantity) < 0 ? "shrink-0 text-rose-700" : "shrink-0 text-emerald-700"}>{Number(movement.quantity) < 0 ? "−" : "+"}{quantityWithUnit(Math.abs(Number(movement.quantity || 0)), movement.unit)}</strong></div>)}</div></section></div> : null}
  </div>;
};

export default InventoryPage;
