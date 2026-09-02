import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import EmptyState from "../../components/common/EmptyState";
import { SkeletonTable } from "../../components/common/Skeletons";
import { fetchRestaurants, updateRestaurantStatus } from "../../services/superAdminService";
import { SubscriptionStatusBadge } from "../../components/subscription/SubscriptionWidgets";

const formattedDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const RestaurantsPage = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [actionId, setActionId] = useState("");
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try { const { data } = await fetchRestaurants({ q: query }); setRestaurants(data.data.items || []); }
    catch (err) { toast.error(err?.response?.data?.message || "Failed to load restaurants"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  const changeStatus = async (restaurant, status) => {
    if (status === "suspended" && !window.confirm("Are you sure you want to suspend this restaurant?")) return;
    setActionId(restaurant._id);
    try { await updateRestaurantStatus(restaurant._id, { status }); toast.success(status === "active" ? "Restaurant activated" : "Restaurant suspended"); await load(); }
    catch (err) { toast.error(err?.response?.data?.message || "Failed to update status"); }
    finally { setActionId(""); }
  };

  return <div className="space-y-4 pb-20">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Restaurants</h2><p className="mt-1 text-sm text-slate-500">Manage restaurant accounts and their current subscription context.</p></div><button type="button" onClick={() => navigate("new")} className="min-h-11 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800">Add Restaurant</button></div>
    <form onSubmit={(event) => { event.preventDefault(); load(); }} className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row"><label className="min-w-0 flex-1"><span className="sr-only">Search restaurants</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search restaurant name, admin or email" className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15" /></label><button type="submit" disabled={loading} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Search</button></form>
    <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">{loading ? <SkeletonTable rows={6} columns={7} /> : <table className="min-w-[980px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{["Restaurant", "Admin", "Plan", "Subscription", "Account", "Created", "Actions"].map((heading) => <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{!restaurants.length ? <tr><td colSpan={7}><EmptyState title="No restaurants found" description="Try a different search or add a restaurant." action={<button type="button" onClick={() => navigate("new")} className="min-h-11 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white">Add Restaurant</button>} /></td></tr> : restaurants.map((restaurant) => <tr key={restaurant._id} className="align-top hover:bg-slate-50"><td className="px-4 py-3"><p className="font-semibold text-slate-900">{restaurant.name}</p><p className="mt-0.5 text-xs text-slate-500">{restaurant.email || restaurant.phone || "—"}</p></td><td className="px-4 py-3"><p>{restaurant.admin?.fullName || "—"}</p><p className="mt-0.5 break-all text-xs text-slate-500">{restaurant.admin?.email || "—"}</p></td><td className="px-4 py-3 capitalize">{restaurant.subscription?.planName || "—"}</td><td className="px-4 py-3">{restaurant.subscription?.status ? <SubscriptionStatusBadge status={restaurant.subscription.status} /> : "—"}</td><td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${restaurant.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>{restaurant.isActive ? "Active" : "Suspended"}</span></td><td className="px-4 py-3 whitespace-nowrap text-slate-600">{formattedDate(restaurant.createdAt)}</td><td className="px-4 py-3"><div className="flex flex-wrap gap-2"><Link to={`${restaurant._id}`} className="min-h-9 rounded-lg bg-brand-700 px-3 py-2 text-xs font-semibold text-white">Details</Link><Link to={`${restaurant._id}/edit`} className="min-h-9 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700">Edit</Link><button type="button" disabled={actionId === restaurant._id} onClick={() => changeStatus(restaurant, restaurant.isActive ? "suspended" : "active")} className={`min-h-9 rounded-lg px-3 text-xs font-semibold disabled:opacity-60 ${restaurant.isActive ? "border border-rose-200 text-rose-700" : "border border-emerald-200 text-emerald-700"}`}>{actionId === restaurant._id ? "Saving…" : restaurant.isActive ? "Suspend" : "Activate"}</button></div></td></tr>)}</tbody></table>}</div>
    <div className="space-y-3 lg:hidden">{loading ? Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-48 animate-pulse rounded-2xl bg-slate-100" />) : !restaurants.length ? <EmptyState title="No restaurants found" description="Try a different search or add a restaurant." action={<button type="button" onClick={() => navigate("new")} className="min-h-11 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white">Add Restaurant</button>} /> : restaurants.map((restaurant) => <article key={restaurant._id} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-semibold text-slate-900">{restaurant.name}</h3><p className="mt-1 break-all text-xs text-slate-500">{restaurant.admin?.email || restaurant.email || "—"}</p></div>{restaurant.subscription?.status ? <SubscriptionStatusBadge status={restaurant.subscription.status} /> : null}</div><dl className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-sm"><div><dt className="text-xs text-slate-500">Plan</dt><dd className="mt-0.5 font-semibold capitalize text-slate-900">{restaurant.subscription?.planName || "—"}</dd></div><div><dt className="text-xs text-slate-500">Account</dt><dd className="mt-0.5 font-semibold text-slate-900">{restaurant.isActive ? "Active" : "Suspended"}</dd></div><div className="col-span-2"><dt className="text-xs text-slate-500">Created</dt><dd className="mt-0.5 text-slate-700">{formattedDate(restaurant.createdAt)}</dd></div></dl><div className="mt-3 grid grid-cols-3 gap-2"><Link to={`${restaurant._id}`} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-brand-700 px-2 text-xs font-semibold text-white">Details</Link><Link to={`${restaurant._id}/edit`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 px-2 text-xs font-semibold text-slate-700">Edit</Link><button type="button" disabled={actionId === restaurant._id} onClick={() => changeStatus(restaurant, restaurant.isActive ? "suspended" : "active")} className={`min-h-11 rounded-xl px-2 text-xs font-semibold disabled:opacity-60 ${restaurant.isActive ? "border border-rose-200 text-rose-700" : "border border-emerald-200 text-emerald-700"}`}>{actionId === restaurant._id ? "Saving…" : restaurant.isActive ? "Suspend" : "Activate"}</button></div></article>)}</div>
  </div>;
};

export default RestaurantsPage;
