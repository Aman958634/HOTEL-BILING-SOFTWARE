import { useEffect, useState } from "react";
import Button from "../ui/Button";
import { validateMenuForm } from "../../utils/formValidation";

const MenuForm = ({ open, onClose, onSubmit, loading, categories, initialData }) => {
  const [form, setForm] = useState({
    name: "",
    category: "",
    description: "",
    price: "",
    discountPrice: "",
    image: "",
    preparationTime: "20",
    ingredients: "",
    spicyLevel: "mild",
    foodType: "vegetarian",
    available: true,
    featured: false,
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setForm({
        name: initialData.name || "",
        category: initialData.category?._id || initialData.category || "",
        description: initialData.description || "",
        price: initialData.price || "",
        discountPrice: initialData.discountPrice || "",
        image: initialData.image || "",
        preparationTime: initialData.preparationTime || initialData.prepTimeMins || "20",
        ingredients: Array.isArray(initialData.ingredients) ? initialData.ingredients.join(", ") : "",
        spicyLevel: initialData.spicyLevel || "mild",
        foodType: initialData.foodType || (initialData.isVeg ? "vegetarian" : "non_vegetarian"),
        available: initialData.isAvailable ?? initialData.available ?? true,
        featured: initialData.featured || false,
      });
    } else {
      setForm({
        name: "",
        category: "",
        description: "",
        price: "",
        discountPrice: "",
        image: "",
        preparationTime: "20",
        ingredients: "",
        spicyLevel: "mild",
        foodType: "vegetarian",
        available: true,
        featured: false,
      });
    }
    setErrors({});
  }, [initialData, open]);

  if (!open) return null;

  const validate = () => {
    const nextErrors = validateMenuForm(form);
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const update = (field, value) => {
    const next = { ...form, [field]: value };
    setForm(next);
    if (errors[field]) setErrors(validateMenuForm(next));
  };

  const submit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    onSubmit({
      ...form,
      price: Number(form.price),
      discountPrice: Number(form.discountPrice || 0),
      preparationTime: Number(form.preparationTime || 20),
      ingredients: form.ingredients,
      available: Boolean(form.available),
      featured: Boolean(form.featured),
    });
  };

  return (
    <div className="ui-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="menu-form-title">
      <form onSubmit={submit} className="ui-modal max-h-[90vh] max-w-3xl overflow-y-auto">
        <h3 id="menu-form-title" className="text-xl font-bold text-slate-900">{initialData ? "Edit Food" : "Add New Food"}</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm text-slate-600">Food Name</label>
            <input aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? "menu-name-error" : undefined} className={`mt-1 w-full rounded-xl border p-2 ${errors.name ? "border-rose-500" : ""}`} value={form.name} onChange={(e) => update("name", e.target.value)} />
            {errors.name && <p id="menu-name-error" role="alert" className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>
          <div>
            <label className="text-sm text-slate-600">Category</label>
            <select aria-invalid={Boolean(errors.category)} aria-describedby={errors.category ? "menu-category-error" : undefined} className={`mt-1 w-full rounded-xl border p-2 ${errors.category ? "border-rose-500" : ""}`} value={form.category} onChange={(e) => update("category", e.target.value)}>
              <option value="">Select Category</option>
              {categories.map((cat) => (
                <option key={cat._id} value={cat._id}>{cat.name}</option>
              ))}
            </select>
            {errors.category && <p id="menu-category-error" role="alert" className="mt-1 text-xs text-red-600">{errors.category}</p>}
          </div>
          <div>
            <label className="text-sm text-slate-600">Price</label>
            <input type="number" min="0.01" step="0.01" aria-invalid={Boolean(errors.price)} aria-describedby={errors.price ? "menu-price-error" : undefined} className={`mt-1 w-full rounded-xl border p-2 ${errors.price ? "border-rose-500" : ""}`} value={form.price} onChange={(e) => update("price", e.target.value)} />
            {errors.price && <p id="menu-price-error" role="alert" className="mt-1 text-xs text-red-600">{errors.price}</p>}
          </div>
          <div>
            <label className="text-sm text-slate-600">Discount Price</label>
            <input type="number" min="0" step="0.01" aria-invalid={Boolean(errors.discountPrice)} aria-describedby={errors.discountPrice ? "menu-discount-error" : undefined} className={`mt-1 w-full rounded-xl border p-2 ${errors.discountPrice ? "border-rose-500" : ""}`} value={form.discountPrice} onChange={(e) => update("discountPrice", e.target.value)} />
            {errors.discountPrice && <p id="menu-discount-error" role="alert" className="mt-1 text-xs text-red-600">{errors.discountPrice}</p>}
          </div>
          <div>
            <label className="text-sm text-slate-600">Food Image URL</label>
            <input type="url" aria-invalid={Boolean(errors.image)} aria-describedby={errors.image ? "menu-image-error" : undefined} className={`mt-1 w-full rounded-xl border p-2 ${errors.image ? "border-rose-500" : ""}`} value={form.image} onChange={(e) => update("image", e.target.value)} />
            {errors.image && <p id="menu-image-error" role="alert" className="mt-1 text-xs text-red-600">{errors.image}</p>}
          </div>
          <div>
            <label className="text-sm text-slate-600">Preparation Time (min)</label>
            <input type="number" min="1" step="1" aria-invalid={Boolean(errors.preparationTime)} aria-describedby={errors.preparationTime ? "menu-prep-error" : undefined} className={`mt-1 w-full rounded-xl border p-2 ${errors.preparationTime ? "border-rose-500" : ""}`} value={form.preparationTime} onChange={(e) => update("preparationTime", e.target.value)} />
            {errors.preparationTime && <p id="menu-prep-error" role="alert" className="mt-1 text-xs text-red-600">{errors.preparationTime}</p>}
          </div>
          <div>
            <label className="text-sm text-slate-600">Spicy Level</label>
            <select className="mt-1 w-full rounded-xl border p-2" value={form.spicyLevel} onChange={(e) => setForm({ ...form, spicyLevel: e.target.value })}>
              <option value="mild">Mild</option>
              <option value="medium">Medium</option>
              <option value="hot">Hot</option>
              <option value="extra_hot">Extra Hot</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-slate-600">Food Type</label>
            <select className="mt-1 w-full rounded-xl border p-2" value={form.foodType} onChange={(e) => setForm({ ...form, foodType: e.target.value })}>
              <option value="vegetarian">Vegetarian</option>
              <option value="non_vegetarian">Non-Vegetarian</option>
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className="text-sm text-slate-600">Description</label>
          <textarea aria-invalid={Boolean(errors.description)} aria-describedby={errors.description ? "menu-description-error" : undefined} className={`mt-1 w-full rounded-xl border p-2 ${errors.description ? "border-rose-500" : ""}`} rows={3} value={form.description} onChange={(e) => update("description", e.target.value)} />
          {errors.description && <p id="menu-description-error" role="alert" className="mt-1 text-xs text-red-600">{errors.description}</p>}
        </div>

        <div className="mt-4">
          <label className="text-sm text-slate-600">Ingredients (comma separated)</label>
          <input className="mt-1 w-full rounded-xl border p-2" value={form.ingredients} onChange={(e) => setForm({ ...form, ingredients: e.target.value })} />
        </div>

        <div className="mt-4 flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.available} onChange={(e) => setForm({ ...form, available: e.target.checked })} />
            Available
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} />
            Featured Item
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button type="submit" loading={loading} loadingText="Saving…">Save Food</Button>
        </div>
      </form>
    </div>
  );
};

export default MenuForm;
