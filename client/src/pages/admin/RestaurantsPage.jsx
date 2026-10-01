import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import EmptyState from "../../components/common/EmptyState";
import { SkeletonTable } from "../../components/common/Skeletons";
import { archiveRestaurant, fetchRestaurants, updateRestaurantStatus } from "../../services/superAdminService";
import { SubscriptionStatusBadge } from "../../components/subscription/SubscriptionWidgets";
import useListRequestState from "../../hooks/useListRequestState";
import { replaceListRecord } from "../../utils/listMutationState";

const formattedDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

const accountState = (restaurant) => {
  if (restaurant?.archivedAt) return "Archived";
  return restaurant?.isActive ? "Active" : "Suspended";
};

const accountStateClass = (restaurant) => {
  if (restaurant?.archivedAt) return "bg-rose-50 text-rose-700";
  return restaurant?.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-700";
};

const RestaurantsPage = () => {
  const [restaurants, setRestaurants] = useState([]);
  const { initialLoading: loading, isRefreshing, beginListRequest, finishListRequest } = useListRequestState();
  const [query, setQuery] = useState("");
  const [actionId, setActionId] = useState("");
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [confirmationName, setConfirmationName] = useState("");
  const [archiving, setArchiving] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    beginListRequest();
    try {
      const { data } = await fetchRestaurants({ q: query });
      setRestaurants(data.data.items || []);
      finishListRequest(true);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to load restaurants");
      finishListRequest(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const changeStatus = async (restaurant, status) => {
    if (status === "suspended" && !window.confirm("Are you sure you want to suspend this restaurant?")) return;
    setActionId(restaurant._id);
    try {
      const { data } = await updateRestaurantStatus(restaurant._id, { status });
      const updated = data?.data?.restaurant || { ...restaurant, isActive: status === "active" };
      setRestaurants((current) => replaceListRecord(current, updated));
      toast.success(status === "active" ? "Restaurant activated" : "Restaurant suspended");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update status");
    } finally {
      setActionId("");
    }
  };

  const closeArchiveDialog = () => {
    if (archiving) return;
    setArchiveTarget(null);
    setConfirmationName("");
  };

  const submitArchive = async (event) => {
    event.preventDefault();
    if (!archiveTarget || confirmationName.trim() !== String(archiveTarget.name || "").trim()) return;

    setArchiving(true);
    try {
      const { data } = await archiveRestaurant(archiveTarget._id, { confirm: true, confirmationName: confirmationName.trim() });
      const archived = data?.data?.restaurant || { ...archiveTarget, archivedAt: new Date().toISOString(), isActive: false };
      setRestaurants((current) => replaceListRecord(current, archived));
      toast.success("Restaurant archived. Historical records were preserved.");
      setArchiveTarget(null);
      setConfirmationName("");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to archive restaurant");
    } finally {
      setArchiving(false);
    }
  };

  const actions = (restaurant, compact = false) => {
    const archived = Boolean(restaurant.archivedAt);
    const actionClass = compact ? "min-h-11" : "min-h-9";
    return (
      <div className={`grid gap-2 ${compact ? "grid-cols-2" : "flex flex-wrap"}`}>
        <Link to={`${restaurant._id}`} className={`${actionClass} inline-flex items-center justify-center rounded-lg bg-brand-700 px-3 py-2 text-xs font-semibold text-white`}>Details</Link>
        <Link to={`${restaurant._id}/edit`} className={`${actionClass} inline-flex items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700`}>Edit</Link>
        {archived ? (
          <span className={`${actionClass} inline-flex items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500`}>Archived</span>
        ) : (
          <button type="button" disabled={actionId === restaurant._id} onClick={() => changeStatus(restaurant, restaurant.isActive ? "suspended" : "active")} className={`${actionClass} rounded-lg px-3 py-2 text-xs font-semibold disabled:opacity-60 ${restaurant.isActive ? "border border-rose-200 text-rose-700" : "border border-emerald-200 text-emerald-700"}`}>{actionId === restaurant._id ? "Saving…" : restaurant.isActive ? "Suspend" : "Activate"}</button>
        )}
        {!archived ? <button type="button" disabled={actionId === restaurant._id} onClick={() => { setArchiveTarget(restaurant); setConfirmationName(""); }} className={`${actionClass} rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 disabled:opacity-60`}>Delete</button> : null}
      </div>
    );
  };

  const canArchive = archiveTarget && confirmationName.trim() === String(archiveTarget.name || "").trim();

  return <div className="space-y-4 pb-20">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Restaurants</h2><p className="mt-1 text-sm text-slate-500">Manage restaurant accounts and their current subscription context.</p></div><button type="button" onClick={() => navigate("new")} className="min-h-11 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800">Add Restaurant</button></div>
    <form onSubmit={(event) => { event.preventDefault(); load(); }} className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row"><label className="min-w-0 flex-1"><span className="sr-only">Search restaurants</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search restaurant name, admin or email" className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15" /></label><button type="submit" disabled={loading || isRefreshing} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Search</button></form>
    <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">{loading ? <SkeletonTable rows={6} columns={7} /> : <table className="min-w-[980px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{["Restaurant", "Admin", "Plan", "Subscription", "Account", "Created", "Actions"].map((heading) => <th key={heading} className="px-4 py-3 font-semibold">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{!restaurants.length ? <tr><td colSpan={7}><EmptyState title="No restaurants found" description="Try a different search or add a restaurant." action={<button type="button" onClick={() => navigate("new")} className="min-h-11 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white">Add Restaurant</button>} /></td></tr> : restaurants.map((restaurant) => <tr key={restaurant._id} className="align-top hover:bg-slate-50"><td className="px-4 py-3"><p className="font-semibold text-slate-900">{restaurant.name}</p><p className="mt-0.5 text-xs text-slate-500">{restaurant.email || restaurant.phone || "—"}</p></td><td className="px-4 py-3"><p>{restaurant.admin?.fullName || "—"}</p><p className="mt-0.5 break-all text-xs text-slate-500">{restaurant.admin?.email || "—"}</p></td><td className="px-4 py-3 capitalize">{restaurant.subscription?.planName || "—"}</td><td className="px-4 py-3">{restaurant.subscription?.status ? <SubscriptionStatusBadge status={restaurant.subscription.status} /> : "—"}</td><td className="px-4 py-3"><span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${accountStateClass(restaurant)}`}>{accountState(restaurant)}</span></td><td className="px-4 py-3 whitespace-nowrap text-slate-600">{formattedDate(restaurant.createdAt)}</td><td className="px-4 py-3">{actions(restaurant)}</td></tr>)}</tbody></table>}</div>
    <div className="space-y-3 lg:hidden">{loading ? Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-48 animate-pulse rounded-2xl bg-slate-100" />) : !restaurants.length ? <EmptyState title="No restaurants found" description="Try a different search or add a restaurant." action={<button type="button" onClick={() => navigate("new")} className="min-h-11 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white">Add Restaurant</button>} /> : restaurants.map((restaurant) => <article key={restaurant._id} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-semibold text-slate-900">{restaurant.name}</h3><p className="mt-1 break-all text-xs text-slate-500">{restaurant.admin?.email || restaurant.email || "—"}</p></div>{restaurant.subscription?.status ? <SubscriptionStatusBadge status={restaurant.subscription.status} /> : null}</div><dl className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-sm"><div><dt className="text-xs text-slate-500">Plan</dt><dd className="mt-0.5 font-semibold capitalize text-slate-900">{restaurant.subscription?.planName || "—"}</dd></div><div><dt className="text-xs text-slate-500">Account</dt><dd className="mt-0.5 font-semibold text-slate-900">{accountState(restaurant)}</dd></div><div className="col-span-2"><dt className="text-xs text-slate-500">Created</dt><dd className="mt-0.5 text-slate-700">{formattedDate(restaurant.createdAt)}</dd></div></dl><div className="mt-3">{actions(restaurant, true)}</div></article>)}</div>
    {archiveTarget ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeArchiveDialog(); }}><form onSubmit={submitArchive} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="archive-restaurant-title"><h3 id="archive-restaurant-title" className="text-xl font-bold text-slate-900">Delete restaurant?</h3><p className="mt-3 text-sm leading-6 text-slate-600">Deleting this restaurant will disable access while preserving financial, payment, invoice and audit records.</p><p className="mt-3 text-sm text-slate-700">Type <strong>{archiveTarget.name}</strong> to confirm this archive action.</p><label className="mt-4 block"><span className="sr-only">Restaurant name confirmation</span><input autoFocus value={confirmationName} onChange={(event) => setConfirmationName(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-rose-600 focus:ring-2 focus:ring-rose-600/15" placeholder={archiveTarget.name} /></label><div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" onClick={closeArchiveDialog} disabled={archiving} className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 disabled:opacity-60">Cancel</button><button type="submit" disabled={!canArchive || archiving} className="min-h-11 rounded-xl bg-rose-700 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{archiving ? "Archiving…" : "Delete / Archive restaurant"}</button></div></form></div> : null}
  </div>;
};

export default RestaurantsPage;
