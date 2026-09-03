import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { FiMapPin, FiPlus, FiPower, FiRefreshCw } from "react-icons/fi";
import EmptyState from "../../components/common/EmptyState";
import RequestState from "../../components/common/RequestState";
import { createOutlet, getOutlets, updateOutletStatus } from "../../services/outletService";

const empty = { name: "", code: "", address: "", city: "", timeZone: "Asia/Kolkata" };
const control = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

const OutletCard = ({ outlet, busy, onStatusChange }) => {
  const location = [outlet.city, outlet.address].filter(Boolean).join(" · ") || "Location not set";
  const nextAction = outlet.isActive ? "Deactivate" : "Activate";
  return <article className="ops-card flex min-w-0 flex-col p-4 sm:p-5">
    <div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Outlet</p><h2 className="mt-1 flex min-w-0 items-start gap-2 text-base font-bold text-slate-900"><FiMapPin className="mt-0.5 shrink-0 text-emerald-700" aria-hidden="true" /><span className="break-words">{outlet.name}</span></h2><p className="mt-1 break-words text-sm text-slate-500">{outlet.code || "No outlet code"} · {location}</p></div><span className={`ops-status-badge shrink-0 ${outlet.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{outlet.isActive ? "Active" : "Inactive"}</span></div>
    {outlet.timeZone ? <p className="mt-3 text-xs text-slate-500">Time zone: {outlet.timeZone}</p> : null}
    <div className="mt-4 border-t border-slate-100 pt-3"><button type="button" disabled={busy} onClick={() => onStatusChange(outlet)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:cursor-wait disabled:opacity-60" aria-label={`${nextAction} ${outlet.name}`}><FiPower aria-hidden="true" />{busy ? "Updating…" : nextAction}</button></div>
  </article>;
};

const OutletSkeleton = () => <div className="h-52 animate-pulse rounded-2xl bg-slate-200" aria-label="Loading outlet" />;

const Outlets = () => {
  const [outlets, setOutlets] = useState([]);
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusTarget, setStatusTarget] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const { data } = await getOutlets(); setOutlets(data?.data || []); }
    catch (requestError) { setError(requestError?.userMessage || "Unable to load outlet data."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const submit = async (event) => {
    event.preventDefault(); setSaving(true);
    try { await createOutlet(form); setForm(empty); toast.success("Outlet created"); await load(); }
    catch (requestError) { toast.error(requestError?.userMessage || "Unable to create outlet"); }
    finally { setSaving(false); }
  };
  const changeStatus = async (outlet) => {
    setStatusTarget(outlet._id);
    try { await updateOutletStatus(outlet._id, !outlet.isActive); toast.success(`${outlet.name} ${outlet.isActive ? "deactivated" : "activated"}`); await load(); }
    catch (requestError) { toast.error(requestError?.userMessage || "Unable to update outlet"); }
    finally { setStatusTarget(""); }
  };
  if (error && !outlets.length) return <RequestState title="Outlets are unavailable" description="Unable to load outlet data." onRetry={load} />;
  return <div className="space-y-5">
    <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Multi-outlet operations</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Outlets</h1><p className="mt-1 max-w-2xl text-sm text-slate-500">Manage your restaurant’s existing outlet records. The header selector continues to show only outlets assigned to the signed-in user.</p></div><button type="button" onClick={load} disabled={loading || Boolean(statusTarget)} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:cursor-wait disabled:opacity-60"><FiRefreshCw className={loading ? "animate-spin" : ""} aria-hidden="true" />Refresh</button></section>
    <form onSubmit={submit} className="ops-card grid gap-3 p-4 sm:p-5 md:grid-cols-2 xl:grid-cols-5" aria-label="Add an outlet"><div className="md:col-span-2 xl:col-span-5"><h2 className="text-base font-bold text-slate-900">Add outlet</h2><p className="mt-1 text-sm text-slate-500">Create a branch using the established outlet workflow.</p></div><input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Outlet name" aria-label="Outlet name" className={control} /><input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} placeholder="Code" aria-label="Outlet code" className={control} /><input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} placeholder="City" aria-label="City" className={control} /><input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} placeholder="Address" aria-label="Address" className={control} /><button disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:cursor-wait disabled:opacity-60"><FiPlus aria-hidden="true" />{saving ? "Creating…" : "Add outlet"}</button></form>
    <section aria-labelledby="outlet-records-heading"><div className="mb-3"><h2 id="outlet-records-heading" className="text-lg font-bold text-slate-900">Outlet records</h2><p className="text-sm text-slate-500">{loading ? "Refreshing outlet records…" : `${outlets.length} outlet${outlets.length === 1 ? "" : "s"} configured`}</p></div>{error ? <RequestState title="Some outlet data may be out of date" description="Unable to refresh outlet data." onRetry={load} /> : null}{loading && !outlets.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"><OutletSkeleton /><OutletSkeleton /><OutletSkeleton /></div> : null}{!loading && !outlets.length ? <div className="ops-card p-6"><EmptyState icon={<FiMapPin className="h-10 w-10" />} title="No outlets yet" description="Add an outlet when you are ready to manage another branch." /></div> : null}{outlets.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{outlets.map((outlet) => <OutletCard key={outlet._id} outlet={outlet} busy={statusTarget === outlet._id} onStatusChange={changeStatus} />)}</div> : null}</section>
  </div>;
};

export default Outlets;
