import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import CategoryTable from "../../components/admin/CategoryTable";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const { data } = await getAdminCategories({ limit: 100, search });
      setCategories(data.data || []);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, [search]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId("");
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Category name is required");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await updateAdminCategory(editingId, form);
        toast.success("Category updated");
      } else {
        await createAdminCategory(form);
        toast.success("Category created");
      }
      resetForm();
      loadCategories();
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
  };

  const confirmDelete = async () => {
    if (!deleteTarget?._id) return;
    setSaving(true);
    try {
      await deleteAdminCategory(deleteTarget._id);
      toast.success("Category deleted");
      setDeleteTarget(null);
      loadCategories();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Cannot delete category");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (item) => {
    try {
      const current = Boolean(item.active ?? item.isActive);
      await toggleAdminCategoryStatus(item._id, !current);
      toast.success("Category status updated");
      setCategories((prev) =>
        prev.map((cat) =>
          cat._id === item._id ? { ...cat, active: !current, isActive: !current } : cat
        )
      );
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to update category");
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Category Management</h2>
        <p className="mt-1 text-sm text-slate-500">Create, edit, disable, and delete menu categories.</p>

        <div className="mt-4">
          <input
            className="w-full rounded-xl border border-slate-300 p-2 text-sm md:w-80"
            placeholder="Search category"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <form onSubmit={submit} className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            className="rounded-xl border border-slate-300 p-2 text-sm"
            placeholder="Category Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="rounded-xl border border-slate-300 p-2 text-sm"
            placeholder="Image URL"
            value={form.image}
            onChange={(e) => setForm({ ...form, image: e.target.value })}
          />
          <textarea
            className="rounded-xl border border-slate-300 p-2 text-sm md:col-span-2"
            placeholder="Description"
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
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
      </div>

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
