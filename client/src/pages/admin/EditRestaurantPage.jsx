import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { getRestaurant, updateRestaurant } from "../../services/superAdminService";
import RequestState from "../../components/common/RequestState";
import { SkeletonPage } from "../../components/common/Skeletons";

const EditRestaurantPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [values, setValues] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setError("");
      const { data } = await getRestaurant(id);
      const restaurant = data?.data?.restaurant;
      setValues({
        name: restaurant?.name || "",
        email: restaurant?.email || "",
        phone: restaurant?.phone || "",
        address: restaurant?.address || "",
        isActive: Boolean(restaurant?.isActive),
      });
    } catch (err) {
      const message = err?.response?.data?.message || "Unable to load this restaurant.";
      setError(message);
      toast.error(message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const updateField = (event) => {
    const { name, value, checked, type } = event.target;
    setValues((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      await updateRestaurant(id, values);
      toast.success("Restaurant updated");
      navigate(`/super-admin/restaurants/${id}`, { replace: true });
    } catch (err) {
      toast.error(err?.response?.data?.message || "Unable to update restaurant");
    } finally {
      setSaving(false);
    }
  };

  if (error) return <RequestState message={error} onRetry={load} />;
  if (!values) return <SkeletonPage cards={1} rows={4} columns={1} />;

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Edit Restaurant</h2>
        <p className="mt-1 text-sm text-slate-500">Update the restaurant account details.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="sm:col-span-2"><span className="text-sm font-medium text-slate-700">Restaurant name</span><input name="name" value={values.name} onChange={updateField} required maxLength="160" className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" /></label>
        <label><span className="text-sm font-medium text-slate-700">Email</span><input name="email" type="email" value={values.email} onChange={updateField} maxLength="254" className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" /></label>
        <label><span className="text-sm font-medium text-slate-700">Phone</span><input name="phone" value={values.phone} onChange={updateField} maxLength="20" className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" /></label>
        <label className="sm:col-span-2"><span className="text-sm font-medium text-slate-700">Address</span><input name="address" value={values.address} onChange={updateField} required maxLength="500" className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" /></label>
      </div>
      <label className="flex items-center gap-3 text-sm font-medium text-slate-700"><input name="isActive" type="checkbox" checked={values.isActive} onChange={updateField} className="size-4" />Active account</label>
      <div className="flex flex-wrap gap-3"><button type="submit" disabled={saving} className="min-h-11 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white disabled:opacity-60">{saving ? "Saving…" : "Save changes"}</button><button type="button" onClick={() => navigate(`/super-admin/restaurants/${id}`)} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700">Cancel</button></div>
    </form>
  );
};

export default EditRestaurantPage;
