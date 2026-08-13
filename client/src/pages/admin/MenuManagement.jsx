import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import MenuForm from "../../components/admin/MenuForm";
import MenuTable from "../../components/admin/MenuTable";
import {
  createAdminMenuItem,
  deleteAdminMenuItem,
  getAdminMenu,
  toggleAdminMenuAvailability,
  updateAdminMenuItem,
} from "../../services/menuService";
import { getAdminCategories } from "../../services/categoryService";

const MenuManagement = () => {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [availability, setAvailability] = useState("all");
  const [order, setOrder] = useState("desc");
  const [openForm, setOpenForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const loadCategories = async () => {
    try {
      const { data } = await getAdminCategories({ limit: 100 });
      setCategories(data.data || []);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load categories");
    }
  };

  const loadMenu = async () => {
    setLoading(true);
    try {
      const params = {
        limit: 100,
        sortBy: "price",
        order,
      };
      if (search) params.search = search;
      if (category) params.category = category;
      if (availability !== "all") params.available = availability;

      const { data } = await getAdminMenu(params);
      setItems(data.data || []);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load menu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    loadMenu();
  }, [search, category, availability, order]);

  const openCreate = () => {
    setEditingItem(null);
    setOpenForm(true);
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setOpenForm(true);
  };

  const submitForm = async (payload) => {
    setSaving(true);
    try {
      if (editingItem?._id) {
        await updateAdminMenuItem(editingItem._id, payload);
        toast.success("Menu item updated");
      } else {
        await createAdminMenuItem(payload);
        toast.success("Menu item created");
      }
      setOpenForm(false);
      setEditingItem(null);
      loadMenu();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to save menu item");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget?._id) return;
    setSaving(true);
    try {
      await deleteAdminMenuItem(deleteTarget._id);
      toast.success("Menu item deleted");
      setItems((prev) => prev.filter((item) => item._id !== deleteTarget._id));
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to delete menu item");
    } finally {
      setSaving(false);
    }
  };

  const toggleAvailability = async (item) => {
    try {
      await toggleAdminMenuAvailability(item._id, !item.isAvailable);
      toast.success("Availability updated");
      setItems((prev) =>
        prev.map((entry) =>
          entry._id === item._id
            ? { ...entry, isAvailable: !entry.isAvailable, available: !entry.isAvailable }
            : entry
        )
      );
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to update availability");
    }
  };

  const summary = useMemo(() => ({
    total: items.length,
    available: items.filter((item) => item.isAvailable).length,
  }), [items]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Menu Management</h2>
            <p className="text-sm text-slate-500">Total items: {summary.total} | Available: {summary.available}</p>
          </div>
          <button className="rounded-xl bg-brand-700 px-4 py-2 text-sm text-white" onClick={openCreate}>
            Add Food
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <input
            className="rounded-xl border border-slate-300 p-2 text-sm"
            placeholder="Search food"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="rounded-xl border border-slate-300 p-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">All categories</option>
            {categories.map((cat) => (
              <option key={cat._id} value={cat._id}>{cat.name}</option>
            ))}
          </select>
          <select className="rounded-xl border border-slate-300 p-2 text-sm" value={availability} onChange={(e) => setAvailability(e.target.value)}>
            <option value="all">All availability</option>
            <option value="true">Available</option>
            <option value="false">Unavailable</option>
          </select>
          <select className="rounded-xl border border-slate-300 p-2 text-sm" value={order} onChange={(e) => setOrder(e.target.value)}>
            <option value="asc">Price: Low to High</option>
            <option value="desc">Price: High to Low</option>
          </select>
        </div>
      </div>

      <MenuTable
        items={items}
        loading={loading}
        onEdit={openEdit}
        onDelete={(item) => setDeleteTarget(item)}
        onToggle={toggleAvailability}
      />

      <MenuForm
        open={openForm}
        onClose={() => {
          setOpenForm(false);
          setEditingItem(null);
        }}
        onSubmit={submitForm}
        loading={saving}
        categories={categories}
        initialData={editingItem}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete menu item"
        message="Are you sure you want to delete this menu item?"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        loading={saving}
      />
    </div>
  );
};

export default MenuManagement;
