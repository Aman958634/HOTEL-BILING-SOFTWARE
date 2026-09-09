import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { fetchRestaurants, fetchSettlementTransactions, getRestaurantCommission, updateRestaurantCommission } from "../../services/superAdminService";

const money = (value) => `₹${Number(value || 0).toFixed(2)}`;

const SuperAdminSettlementsPage = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [restaurantId, setRestaurantId] = useState("");
  const [commission, setCommission] = useState({ commissionType: "NONE", commissionPercentage: 0, fixedAmount: 0 });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadTransactions = useCallback(async (id = "") => {
    try { const { data } = await fetchSettlementTransactions(id ? { restaurantId: id } : {}); setTransactions(data.data || []); }
    catch (error) { toast.error(error?.response?.data?.message || "Unable to load settlement allocations"); }
  }, []);
  useEffect(() => { fetchRestaurants({ limit: 100 }).then(({ data }) => setRestaurants(data.data?.items || [])).catch(() => {}); void loadTransactions(""); }, [loadTransactions]);
  const chooseRestaurant = async (id) => {
    setRestaurantId(id); setCommission({ commissionType: "NONE", commissionPercentage: 0, fixedAmount: 0 });
    await loadTransactions(id);
    if (!id) return;
    try { const { data } = await getRestaurantCommission(id); setCommission(data.data.commission); }
    catch (error) { toast.error(error?.response?.data?.message || "Unable to load commission configuration"); }
  };
  const save = async (event) => {
    event.preventDefault(); if (!restaurantId) return toast.error("Select a restaurant first");
    setLoading(true);
    try { const { data } = await updateRestaurantCommission(restaurantId, commission); setCommission(data.data.commission); toast.success("Commission configuration saved"); }
    catch (error) { toast.error(error?.response?.data?.message || "Unable to save commission configuration"); }
    finally { setLoading(false); }
  };
  return <div className="space-y-4 pb-20"><header><h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Cashfree settlements</h2><p className="mt-1 text-sm text-slate-500">Configure platform commission and review allocation separately from payment and reconciliation status.</p></header><section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><form onSubmit={save} className="grid gap-3 lg:grid-cols-4 lg:items-end"><label className="text-sm font-medium text-slate-700">Restaurant<select value={restaurantId} onChange={(event) => chooseRestaurant(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"><option value="">Select restaurant</option>{restaurants.map((restaurant) => <option value={restaurant._id} key={restaurant._id}>{restaurant.name}</option>)}</select></label><label className="text-sm font-medium text-slate-700">Commission type<select value={commission.commissionType} onChange={(event) => setCommission((value) => ({ ...value, commissionType: event.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"><option value="NONE">No commission</option><option value="PERCENTAGE">Percentage</option><option value="FIXED">Fixed amount</option></select></label>{commission.commissionType === "PERCENTAGE" ? <label className="text-sm font-medium text-slate-700">Percentage<input required min="0" max="100" step="0.01" type="number" value={commission.commissionPercentage} onChange={(event) => setCommission((value) => ({ ...value, commissionPercentage: event.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" /></label> : commission.commissionType === "FIXED" ? <label className="text-sm font-medium text-slate-700">Amount (₹)<input required min="0" step="0.01" type="number" value={commission.fixedAmount} onChange={(event) => setCommission((value) => ({ ...value, fixedAmount: event.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" /></label> : <div /> }<button disabled={loading || !restaurantId} className="min-h-11 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white disabled:opacity-60">{loading ? "Saving…" : "Save commission"}</button></form><p className="mt-3 text-xs text-slate-500">Commission values are server-authoritative and apply only to future verified Cashfree payment attempts. No transfer or refund action is available here.</p></section><section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-slate-900">Allocation & settlement status</h3><p className="mt-1 text-xs text-slate-500">A paid customer payment does not mean the provider has settled funds to the restaurant.</p></div><button type="button" onClick={() => loadTransactions()} className="min-h-10 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700">Refresh list</button></div><div className="mt-4 space-y-2">{transactions.length ? transactions.map((item) => <div key={item.id} className="grid gap-2 rounded-xl bg-slate-50 p-3 text-sm sm:grid-cols-4"><div><span className="text-xs text-slate-500">Gross</span><p className="font-semibold text-slate-900">{money(item.grossAmount)}</p></div><div><span className="text-xs text-slate-500">Vendor / platform</span><p className="font-semibold text-slate-900">{money(item.vendorShare)} / {money(item.platformShare)}</p></div><div><span className="text-xs text-slate-500">Allocation</span><p className="font-semibold text-slate-900">{item.splitStatus}</p></div><div><span className="text-xs text-slate-500">Settlement</span><p className="font-semibold text-slate-900">{item.settlementStatus}</p></div></div>) : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No settlement allocations found.</p>}</div></section></div>;
};

export default SuperAdminSettlementsPage;
