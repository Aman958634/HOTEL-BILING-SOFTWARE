import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FiBox, FiPlus, FiRefreshCw, FiSave, FiSliders } from "react-icons/fi";
import EmptyState from "../../components/common/EmptyState";
import RequestState from "../../components/common/RequestState";
import { SkeletonTable } from "../../components/common/Skeletons";
import { getAdminMenu } from "../../services/menuService";
import { createInventoryItem, createRecipe, adjustInventoryItem, getInventoryItems, getRecipes } from "../../services/inventoryService";

const initialItem = { itemName: "", sku: "", unit: "kg", baseUnit: "kg", quantity: "", reorderLevel: "", costPerUnit: "" };
const initialRecipe = { food: "", name: "", status: "DRAFT", yieldQuantity: "1", ingredients: [{ inventoryItem: "", quantity: "", unit: "g" }] };
const fieldClass = "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm";

const InventoryPage = () => {
  const [items, setItems] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [itemForm, setItemForm] = useState(initialItem);
  const [recipeForm, setRecipeForm] = useState(initialRecipe);
  const [adjustment, setAdjustment] = useState({});
  const [saving, setSaving] = useState(false);

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

  const submitItem = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      // Validate unit and baseUnit don't contain numbers
      if (/\d/.test(itemForm.unit)) {
        toast.error("Unit cannot contain numbers (e.g., use 'kg' not '10kg')");
        setSaving(false);
        return;
      }
      if (/\d/.test(itemForm.baseUnit)) {
        toast.error("Base unit cannot contain numbers (e.g., use 'kg' not '10kg')");
        setSaving(false);
        return;
      }
      
      await createInventoryItem({ ...itemForm, quantity: Number(itemForm.quantity || 0), reorderLevel: Number(itemForm.reorderLevel || 0), costPerUnit: Number(itemForm.costPerUnit || 0) });
      setItemForm(initialItem);
      toast.success("Inventory item created");
      await load();
    } catch (err) { toast.error(err?.response?.data?.message || "Unable to create inventory item"); }
    finally { setSaving(false); }
  };

  const submitAdjustment = async (item) => {
    const value = Number(adjustment[item._id]);
    if (!Number.isFinite(value) || value === 0) return;
    setSaving(true);
    try {
      await adjustInventoryItem(item._id, { quantity: value, unit: item.baseUnit || item.unit, reason: "Manual stock adjustment" });
      setAdjustment((current) => ({ ...current, [item._id]: "" }));
      toast.success("Stock adjusted");
      await load();
    } catch (err) { toast.error(err?.response?.data?.message || "Unable to adjust stock"); }
    finally { setSaving(false); }
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

  const inventoryValue = useMemo(() => items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.costPerUnit || 0), 0), [items]);

  return (
    <div className="space-y-5 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Inventory & Recipes</h2><p className="mt-1 text-sm text-slate-500">Track real stock, recipe ingredients, costing and auditable adjustments.</p></div>
        <button type="button" onClick={load} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"><FiRefreshCw /> Refresh</button>
      </div>

      {error ? <RequestState message={error} onRetry={load} /> : loading ? <SkeletonTable rows={7} columns={7} /> : (
        <>
          <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs uppercase text-slate-500">Items</p><p className="mt-2 text-2xl font-bold">{items.length}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs uppercase text-slate-500">Low stock</p><p className="mt-2 text-2xl font-bold text-amber-600">{items.filter((item) => ["LOW", "CRITICAL"].includes(item.status)).length}</p></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs uppercase text-slate-500">Stock value</p><p className="mt-2 text-2xl font-bold">₹{inventoryValue.toFixed(2)}</p></div></div>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="mb-4 flex items-center gap-2 text-lg font-semibold"><FiPlus /> Add inventory item</h3><form onSubmit={submitItem} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[["itemName","Name"],["sku","SKU"],["unit","Unit"],["baseUnit","Base unit"],["quantity","Opening stock"],["reorderLevel","Reorder level"],["costPerUnit","Cost per base unit"]].map(([key, label]) => <label key={key} className="space-y-1 text-sm text-slate-700"><span>{label}</span><input className={fieldClass} required={key === "itemName" || key === "sku" || key === "unit"} type={key === "quantity" || key === "reorderLevel" || key === "costPerUnit" ? "number" : "text"} min={key === "quantity" || key === "reorderLevel" || key === "costPerUnit" ? "0" : undefined} step="any" value={itemForm[key]} onChange={(event) => setItemForm((current) => ({ ...current, [key]: event.target.value }))} /></label>)}<button disabled={saving} className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"><FiSave /> Save item</button></form></section>
          <section>{items.length === 0 ? <EmptyState icon={<FiBox className="h-10 w-10" />} title="No inventory items yet" description="Add inventory items to start tracking stock." /> : <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="min-w-[900px] w-full text-sm"><thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr>{["Item","SKU","Stock","Unit","Reorder","Cost","Status","Adjust"].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr></thead><tbody>{items.map((item) => <tr key={item._id} className="border-t border-slate-100"><td className="px-4 py-3 font-medium">{item.itemName}</td><td className="px-4 py-3">{item.sku}</td><td className="px-4 py-3">{item.quantity}</td><td className="px-4 py-3">{item.baseUnit || item.unit}</td><td className="px-4 py-3">{item.reorderLevel}</td><td className="px-4 py-3">₹{Number(item.costPerUnit || 0).toFixed(2)}</td><td className="px-4 py-3">{item.status}</td><td className="px-4 py-3"><div className="flex gap-2"><input className="w-24 rounded-lg border border-slate-300 px-2 py-1" type="number" step="any" placeholder="+/-" value={adjustment[item._id] || ""} onChange={(event) => setAdjustment((current) => ({ ...current, [item._id]: event.target.value }))} /><button type="button" disabled={saving} onClick={() => submitAdjustment(item)} className="rounded-lg border border-slate-300 px-2 py-1"><FiSliders /></button></div></td></tr>)}</tbody></table></div>}</section>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="mb-4 text-lg font-semibold">Create recipe</h3><form onSubmit={submitRecipe} className="space-y-3"><div className="grid gap-3 sm:grid-cols-3"><select className={fieldClass} required value={recipeForm.food} onChange={(event) => setRecipeForm((current) => ({ ...current, food: event.target.value }))}><option value="">Select menu item</option>{foods.map((food) => <option key={food._id} value={food._id}>{food.name}</option>)}</select><input className={fieldClass} required placeholder="Recipe name" value={recipeForm.name} onChange={(event) => setRecipeForm((current) => ({ ...current, name: event.target.value }))} /><input className={fieldClass} required type="number" min="1" step="any" placeholder="Yield portions" value={recipeForm.yieldQuantity} onChange={(event) => setRecipeForm((current) => ({ ...current, yieldQuantity: event.target.value }))} /></div>{recipeForm.ingredients.map((line, index) => <div key={index} className="grid gap-2 sm:grid-cols-[1fr_140px_140px_auto]"><select className={fieldClass} required value={line.inventoryItem} onChange={(event) => setRecipeForm((current) => ({ ...current, ingredients: current.ingredients.map((entry, i) => i === index ? { ...entry, inventoryItem: event.target.value } : entry) }))}><option value="">Select ingredient</option>{items.map((item) => <option key={item._id} value={item._id}>{item.itemName}</option>)}</select><input className={fieldClass} required type="number" min="0" step="any" placeholder="Quantity" value={line.quantity} onChange={(event) => setRecipeForm((current) => ({ ...current, ingredients: current.ingredients.map((entry, i) => i === index ? { ...entry, quantity: event.target.value } : entry) }))} /><input className={fieldClass} required placeholder="Unit" value={line.unit} onChange={(event) => setRecipeForm((current) => ({ ...current, ingredients: current.ingredients.map((entry, i) => i === index ? { ...entry, unit: event.target.value } : entry) }))} /><button type="button" onClick={() => setRecipeForm((current) => ({ ...current, ingredients: current.ingredients.filter((_, i) => i !== index) }))} className="rounded-xl border border-rose-200 px-3 text-rose-700">Remove</button></div>)}<div className="flex flex-wrap gap-2"><button type="button" onClick={() => setRecipeForm((current) => ({ ...current, ingredients: [...current.ingredients, { inventoryItem: "", quantity: "", unit: "g" }] }))} className="rounded-xl border border-slate-300 px-3 py-2 text-sm">+ Ingredient</button><button disabled={saving} className="rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white">Save recipe</button></div></form></section>
          <section><h3 className="mb-3 text-lg font-semibold">Recipes</h3>{recipes.length === 0 ? <EmptyState title="No recipes yet" description="Create an active recipe to connect menu items to stock consumption." /> : <div className="grid gap-3 md:grid-cols-2">{recipes.map((recipe) => <article key={recipe._id} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex justify-between"><h4 className="font-semibold">{recipe.name}</h4><span className="text-xs text-slate-500">v{recipe.version} · {recipe.status}</span></div><p className="mt-1 text-sm text-slate-500">{recipe.food?.name || "Menu item"} · {recipe.ingredients?.length || 0} ingredients</p></article>)}</div>}</section>
        </>
      )}
    </div>
  );
};

export default InventoryPage;
