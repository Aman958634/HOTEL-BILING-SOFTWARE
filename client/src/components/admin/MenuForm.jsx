import { useEffect, useState } from "react";
import Button from "../ui/Button";

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
    const nextErrors = {};

    if (!form.name.trim()) nextErrors.name = "Food name required";
    if (!form.category) nextErrors.category = "Category required";
    if (!form.price || Number(form.price) <= 0) nextErrors.price = "Price must be greater than 0";
    if (form.image && !/^https?:\/\//i.test(form.image)) nextErrors.image = "Image must be valid URL";
    if (form.description && (form.description.length < 10 || form.description.length > 1200)) {
      nextErrors.description = "Description must be between 10 and 1200 characters";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
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
            <input className="mt-1 w-full rounded-xl border p-2" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
          </div>
          <div>
            <label className="text-sm text-slate-600">Category</label>
            <select className="mt-1 w-full rounded-xl border p-2" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="">Select Category</option>
              {categories.map((cat) => (
                <option key={cat._id} value={cat._id}>{cat.name}</option>
              ))}
            </select>
            {errors.category && <p className="mt-1 text-xs text-red-600">{errors.category}</p>}
          </div>
          <div>
            <label className="text-sm text-slate-600">Price</label>
            <input type="number" className="mt-1 w-full rounded-xl border p-2" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            {errors.price && <p className="mt-1 text-xs text-red-600">{errors.price}</p>}
          </div>
          <div>
            <label className="text-sm text-slate-600">Discount Price</label>
            <input type="number" className="mt-1 w-full rounded-xl border p-2" value={form.discountPrice} onChange={(e) => setForm({ ...form, discountPrice: e.target.value })} />
          </div>
          <div>
            <label className="text-sm text-slate-600">Food Image URL</label>
            <input className="mt-1 w-full rounded-xl border p-2" value={form.image} onChange={(e) => setForm({ ...form, image: e.target.value })} />
            {errors.image && <p className="mt-1 text-xs text-red-600">{errors.image}</p>}
          </div>
          <div>
            <label className="text-sm text-slate-600">Preparation Time (min)</label>
            <input type="number" className="mt-1 w-full rounded-xl border p-2" value={form.preparationTime} onChange={(e) => setForm({ ...form, preparationTime: e.target.value })} />
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
          <textarea className="mt-1 w-full rounded-xl border p-2" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description}</p>}
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
