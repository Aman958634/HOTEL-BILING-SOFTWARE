import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { FiSearch } from "react-icons/fi";
import CategoryTable from "../../components/admin/CategoryTable";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import useListRequestState from "../../hooks/useListRequestState";
import { prependListRecord, removeListRecord, replaceListRecord } from "../../utils/listMutationState";
import { validateCategoryForm } from "../../utils/formValidation";
import {
  createAdminCategory,
  deleteAdminCategory,
  getAdminCategories,
  toggleAdminCategoryStatus,
  updateAdminCategory,
} from "../../services/categoryService";

const emptyForm = { name: "", description: "", image: "", active: true };

const CategoryManagement = () => {
  const [categories, setCategories] = useState([]);
  const { initialLoading: loading, beginListRequest, finishListRequest } = useListRequestState();
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [editingId, setEditingId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadCategories = async () => {
    beginListRequest();
    try {
      const { data } = await getAdminCategories({ limit: 100, search });
      setCategories(data.data || []);
      finishListRequest(true);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load categories");
      finishListRequest(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, [search]);

  const resetForm = () => {
    setForm(emptyForm);
    setErrors({});
    setEditingId("");
  };

  const updateForm = (field, value) => {
    const next = { ...form, [field]: value };
    setForm(next);
    if (errors[field]) setErrors(validateCategoryForm(next));
  };

  const submit = async (e) => {
    e.preventDefault();
    const nextErrors = validateCategoryForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    try {
      if (editingId) {
        const { data } = await updateAdminCategory(editingId, form);
        setCategories((current) => replaceListRecord(current, data.data));
        toast.success("Category updated");
      } else {
        const { data } = await createAdminCategory(form);
        const created = data.data;
        if (!search || created.name.toLowerCase().includes(search.trim().toLowerCase())) {
          setCategories((current) => prependListRecord(current, created));
        }
        toast.success("Category created");
      }
      resetForm();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  const editCategory = (item) => {
    setEditingId(item._id);
    setForm({
      name: item.name || "",
      description: item.description || "",
      image: item.image || "",
      active: Boolean(item.active ?? item.isActive),
    });
    setErrors({});
  };

  const confirmDelete = async () => {
    if (!deleteTarget?._id) return;
    setSaving(true);
    try {
      await deleteAdminCategory(deleteTarget._id);
      toast.success("Category deleted");
      setCategories((current) => removeListRecord(current, deleteTarget._id));
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Cannot delete category");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (item) => {
    try {
      const current = Boolean(item.active ?? item.isActive);
      const { data } = await toggleAdminCategoryStatus(item._id, !current);
      toast.success("Category status updated");
      setCategories((currentItems) => replaceListRecord(currentItems, data.data));
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update category");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Category Management</h2>
        <p className="mt-1 text-sm text-slate-500">Create, edit, disable, and delete menu categories.</p>
      </div>

        <div className="mt-4">
          <div className="relative">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm md:w-80"
              placeholder="Search category"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <form onSubmit={submit} className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "category-name-error" : undefined}
            className={`rounded-xl border p-2 text-sm ${errors.name ? "border-rose-500" : "border-slate-300"}`}
            placeholder="Category Name"
            value={form.name}
            onChange={(e) => updateForm("name", e.target.value)}
          />
          {errors.name && <p id="category-name-error" role="alert" className="-mt-2 text-xs text-rose-600">{errors.name}</p>}
          <input
            type="url"
            aria-invalid={Boolean(errors.image)}
            aria-describedby={errors.image ? "category-image-error" : undefined}
            className={`rounded-xl border p-2 text-sm ${errors.image ? "border-rose-500" : "border-slate-300"}`}
            placeholder="Image URL"
            value={form.image}
            onChange={(e) => updateForm("image", e.target.value)}
          />
          {errors.image && <p id="category-image-error" role="alert" className="-mt-2 text-xs text-rose-600">{errors.image}</p>}
          <textarea
            aria-invalid={Boolean(errors.description)}
            aria-describedby={errors.description ? "category-description-error" : undefined}
            className={`rounded-xl border p-2 text-sm md:col-span-2 ${errors.description ? "border-rose-500" : "border-slate-300"}`}
            placeholder="Description"
            rows={2}
            maxLength={500}
            value={form.description}
            onChange={(e) => updateForm("description", e.target.value)}
          />
          {errors.description && <p id="category-description-error" role="alert" className="-mt-2 text-xs text-rose-600 md:col-span-2">{errors.description}</p>}
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            Active
          </label>

          <div className="md:col-span-2 flex flex-wrap gap-2">
            <button disabled={saving} className="rounded-xl bg-brand-700 px-4 py-2 text-sm text-white disabled:opacity-70" type="submit">
              {saving ? "Saving..." : editingId ? "Update Category" : "Add Category"}
            </button>
            {editingId && (
              <button type="button" className="rounded-xl border border-slate-300 px-4 py-2 text-sm" onClick={resetForm}>
                Cancel Edit
              </button>
            )}
          </div>
        </form>

        <CategoryTable
        items={categories}
        loading={loading}
        onEdit={editCategory}
        onDelete={(item) => setDeleteTarget(item)}
        onToggle={toggleStatus}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete category"
        message="Are you sure you want to delete this category?"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={saving}
      />
    </div>
  );
};

export default CategoryManagement;
