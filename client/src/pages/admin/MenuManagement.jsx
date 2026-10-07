import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { FiBookOpen, FiPlus, FiSearch } from "react-icons/fi";
import ModuleIcon from "../../components/common/ModuleIcon";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import MenuForm from "../../components/admin/MenuForm";
import MenuTable from "../../components/admin/MenuTable";
import {
  createAdminMenuItem,
  deleteAdminMenuItem,
  getAllAdminMenu,
  toggleAdminMenuAvailability,
  updateAdminMenuItem,
} from "../../services/menuService";
import { getAdminCategories } from "../../services/categoryService";
import useListRequestState from "../../hooks/useListRequestState";

const MenuHeader = memo(({ total, available, onCreate }) => (
  <div className="flex flex-wrap items-center justify-between gap-4">
    <div>
      <h2 className="flex items-center gap-3 text-xl font-bold text-slate-900 sm:text-2xl"><ModuleIcon icon={<FiBookOpen />} module="menu" variant="header" />Menu Management</h2>
      <p className="mt-1 text-sm text-slate-500">Total items: {total} | Available: {available}</p>
    </div>
    <button className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-700" onClick={onCreate}>
      <FiPlus className="h-4 w-4" aria-hidden="true" />
      Add Food
    </button>
  </div>
));

const MenuFilters = memo(({ search, category, availability, order, categories, onSearchChange, onCategoryChange, onAvailabilityChange, onOrderChange }) => (
  <div className="mt-4 grid gap-3 md:grid-cols-4">
    <div className="relative min-w-0">
      <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
      <input className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm" placeholder="Search food" value={search} onChange={onSearchChange} />
    </div>
    <select className="min-w-0 rounded-xl border border-slate-300 p-2 text-sm" value={category} onChange={onCategoryChange}>
      <option value="">All categories</option>
      {categories.map((cat) => <option key={cat._id} value={cat._id}>{cat.name}</option>)}
    </select>
    <select className="min-w-0 rounded-xl border border-slate-300 p-2 text-sm" value={availability} onChange={onAvailabilityChange}>
      <option value="all">All availability</option>
      <option value="true">Available</option>
      <option value="false">Unavailable</option>
    </select>
    <select className="min-w-0 rounded-xl border border-slate-300 p-2 text-sm" value={order} onChange={onOrderChange}>
      <option value="asc">Price: Low to High</option>
      <option value="desc">Price: High to Low</option>
    </select>
  </div>
));

const MenuManagement = () => {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const { initialLoading: loading, isRefreshing, beginListRequest, finishListRequest } = useListRequestState();
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [availability, setAvailability] = useState("all");
  const [order, setOrder] = useState("desc");
  const [openForm, setOpenForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [menuError, setMenuError] = useState("");
  const menuRequestRef = useRef(0);

  const loadCategories = useCallback(async () => {
    try {
      const { data } = await getAdminCategories({ limit: 100 });
      setCategories(data.data || []);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to load categories");
    }
  }, []);

  const loadMenu = useCallback(async () => {
    const requestId = menuRequestRef.current + 1;
    menuRequestRef.current = requestId;
    beginListRequest();
    try {
      const params = {
        sortBy: "price",
        order,
        ...(category ? { category } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(availability === "all" ? {} : { available: availability }),
      };
      const menuItems = await getAllAdminMenu(params);
      if (requestId !== menuRequestRef.current) return;
      setItems(menuItems);
      setMenuError("");
      finishListRequest(true);
    } catch (error) {
      if (requestId !== menuRequestRef.current) return;
      setMenuError(error?.response?.data?.message || "Failed to load menu");
      toast.error(error?.response?.data?.message || "Failed to load menu");
      finishListRequest(false);
    }
  }, [availability, beginListRequest, category, finishListRequest, order, search]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  const openCreate = useCallback(() => {
    setEditingItem(null);
    setOpenForm(true);
  }, []);

  const openEdit = useCallback((item) => {
    setEditingItem(item);
    setOpenForm(true);
  }, []);

  const closeForm = useCallback(() => {
    setOpenForm(false);
    setEditingItem(null);
  }, []);

  const submitForm = useCallback(async (payload) => {
    setSaving(true);
    try {
      if (editingItem?._id) {
        await updateAdminMenuItem(editingItem._id, payload);
        toast.success("Menu item updated");
      } else {
        await createAdminMenuItem(payload);
        toast.success("Menu item created");
      }
      void loadMenu();
      closeForm();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to save menu item");
    } finally {
      setSaving(false);
    }
  }, [closeForm, editingItem, loadMenu]);

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget?._id) return;
    setSaving(true);
    try {
      await deleteAdminMenuItem(deleteTarget._id);
      toast.success("Menu item deleted");
      void loadMenu();
      setDeleteTarget(null);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to delete menu item");
    } finally {
      setSaving(false);
    }
  }, [deleteTarget, loadMenu]);

  const toggleAvailability = useCallback(async (item) => {
    try {
      await toggleAdminMenuAvailability(item._id, !item.isAvailable);
      toast.success("Availability updated");
      void loadMenu();
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to update availability");
    }
  }, [loadMenu]);

  const requestDelete = useCallback((item) => setDeleteTarget(item), []);
  const clearDeleteTarget = useCallback(() => setDeleteTarget(null), []);
  const updateSearch = useCallback((event) => setSearch(event.target.value), []);
  const updateCategory = useCallback((event) => setCategory(event.target.value), []);
  const updateAvailability = useCallback((event) => setAvailability(event.target.value), []);
  const updateOrder = useCallback((event) => setOrder(event.target.value), []);

  const summary = useMemo(() => ({
    total: items.length,
    available: items.reduce((count, item) => count + (item.isAvailable ?? item.available ?? true ? 1 : 0), 0),
  }), [items]);

  return (
    <div className="space-y-4">
      <MenuHeader total={summary.total} available={summary.available} onCreate={openCreate} />
      <MenuFilters search={search} category={category} availability={availability} order={order} categories={categories} onSearchChange={updateSearch} onCategoryChange={updateCategory} onAvailabilityChange={updateAvailability} onOrderChange={updateOrder} />
      {menuError ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700"><p>{menuError}</p><button type="button" onClick={loadMenu} className="mt-3 rounded-lg border border-rose-300 bg-white px-3 py-2 font-medium">Retry</button></div> : <MenuTable items={items} loading={loading || isRefreshing} onEdit={openEdit} onDelete={requestDelete} onToggle={toggleAvailability} />}
      <MenuForm open={openForm} onClose={closeForm} onSubmit={submitForm} loading={saving} categories={categories} initialData={editingItem} />
      <ConfirmDialog open={Boolean(deleteTarget)} title="Delete menu item" message="Are you sure you want to delete this menu item?" onCancel={clearDeleteTarget} onConfirm={confirmDelete} loading={saving} />
    </div>
  );
};

export default MenuManagement;
