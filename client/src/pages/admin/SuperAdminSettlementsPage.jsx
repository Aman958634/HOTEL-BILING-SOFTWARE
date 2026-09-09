import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { fetchRestaurants, fetchSettlementTransactions, getRestaurantCommission, updateRestaurantCommission } from "../../services/superAdminService";

const money = (value) => `₹${Number(value || 0).toFixed(2)}`;
const commissionLabel = (item) => item.commissionType === "PERCENTAGE"
  ? `${Number(item.commissionValue ?? (item.commissionBps || 0) / 100).toFixed(2).replace(/\.00$/, "")}%`
  : item.commissionType === "FIXED" ? money(item.commissionValue) : "None";

const SuperAdminSettlementsPage = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [restaurantId, setRestaurantId] = useState("");
  const [commission, setCommission] = useState({ commissionType: "NONE", commissionPercentage: 0, fixedAmount: 0 });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [transactionsError, setTransactionsError] = useState("");

  const loadTransactions = useCallback(async (id = "") => {
    setTransactionsLoading(true);
    setTransactionsError("");
    try {
      const { data } = await fetchSettlementTransactions(id ? { restaurantId: id } : {});
      setTransactions(Array.isArray(data.data) ? data.data : []);
    } catch (error) {
      setTransactions([]);
      setTransactionsError(error?.response?.data?.message || "Unable to load settlement allocations");
    } finally {
      setTransactionsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRestaurants({ limit: 100 }).then(({ data }) => setRestaurants(data.data?.items || [])).catch(() => {});
    void loadTransactions("");
  }, [loadTransactions]);

  const chooseRestaurant = async (id) => {
    setRestaurantId(id);
    setCommission({ commissionType: "NONE", commissionPercentage: 0, fixedAmount: 0 });
    await loadTransactions(id);
    if (!id) return;
    try {
      const { data } = await getRestaurantCommission(id);
      setCommission(data.data.commission);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to load commission configuration");
    }
  };

  const save = async (event) => {
    event.preventDefault();
    if (!restaurantId) return toast.error("Select a restaurant first");
    setLoading(true);
    try {
      await updateRestaurantCommission(restaurantId, commission);
      // Read the persisted configuration back from the API; browser state is
      // never the source of truth for commercial controls.
      const { data } = await getRestaurantCommission(restaurantId);
      const saved = data.data.commission;
      setCommission(saved);
      const label = saved.commissionType === "PERCENTAGE"
        ? `${Number(saved.commissionValue ?? saved.commissionPercentage).toFixed(2).replace(/\.00$/, "")}%`
        : saved.commissionType === "FIXED" ? money(saved.fixedAmount) : "No";
      toast.success(saved.commissionType === "NONE" ? "No commission saved successfully." : `${label} commission saved successfully.`);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to save commission configuration");
    } finally {
      setLoading(false);
    }
  };

  return <div className="space-y-4 pb-20">
    <header>
      <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Cashfree settlements</h2>
      <p className="mt-1 text-sm text-slate-500">Configure platform commission and review allocation separately from customer payment and provider settlement status.</p>
    </header>
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <form onSubmit={save} className="grid gap-3 lg:grid-cols-4 lg:items-end">
        <label className="text-sm font-medium text-slate-700">Restaurant
          <select value={restaurantId} onChange={(event) => chooseRestaurant(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"><option value="">Select restaurant</option>{restaurants.map((restaurant) => <option value={restaurant._id} key={restaurant._id}>{restaurant.name}</option>)}</select>
        </label>
        <label className="text-sm font-medium text-slate-700">Commission type
          <select value={commission.commissionType} onChange={(event) => setCommission((value) => ({ ...value, commissionType: event.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"><option value="NONE">No commission</option><option value="PERCENTAGE">Percentage</option><option value="FIXED">Fixed amount</option></select>
        </label>
        {commission.commissionType === "PERCENTAGE" ? <label className="text-sm font-medium text-slate-700">Percentage
          <input required min="0" max="100" step="0.01" type="number" value={commission.commissionPercentage} onChange={(event) => setCommission((value) => ({ ...value, commissionPercentage: event.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" />
        </label> : commission.commissionType === "FIXED" ? <label className="text-sm font-medium text-slate-700">Amount (₹)
          <input required min="0" step="0.01" type="number" value={commission.fixedAmount} onChange={(event) => setCommission((value) => ({ ...value, fixedAmount: event.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" />
        </label> : <div />}
        <button disabled={loading || !restaurantId} className="min-h-11 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white disabled:opacity-60">{loading ? "Saving…" : "Save commission"}</button>
      </form>
      <p className="mt-3 text-xs text-slate-500">Commission values are server-authoritative and apply only to future verified Cashfree payment attempts. No transfer or refund action is available here.</p>
    </section>
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-slate-900">Allocation & settlement status</h3><p className="mt-1 text-xs text-slate-500">Allocation success does not mean Cashfree has settled funds to the restaurant.</p></div><button type="button" onClick={() => loadTransactions(restaurantId)} disabled={transactionsLoading} className="min-h-10 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 disabled:opacity-60">Refresh list</button></div>
      <div className="mt-4 overflow-x-auto">
        {transactionsLoading ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Loading settlement allocations…</p> : transactionsError ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><p>{transactionsError}</p><button type="button" onClick={() => loadTransactions(restaurantId)} className="mt-3 min-h-10 rounded-lg border border-rose-300 bg-white px-3 text-sm font-semibold">Retry</button></div> : transactions.length ? <table className="min-w-[980px] w-full text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><tr><th className="p-3">Restaurant</th><th className="p-3">Order / payment</th><th className="p-3">Gross</th><th className="p-3">Commission</th><th className="p-3">Platform share</th><th className="p-3">Vendor share</th><th className="p-3">Allocation</th><th className="p-3">Settlement</th><th className="p-3">Created</th></tr></thead><tbody>{transactions.map((item) => <tr key={item.id} className="border-b border-slate-100 last:border-0"><td className="p-3 font-medium text-slate-900">{item.restaurantName || "Restaurant"}</td><td className="p-3"><p className="font-medium text-slate-900">{item.orderNumber || item.order}</p><p className="text-xs text-slate-500">{item.provider === "CASHFREE" ? "Cashfree" : item.provider}{item.paymentReference ? ` · ${item.paymentReference}` : ""}</p></td><td className="p-3">{money(item.grossAmount)}</td><td className="p-3">{commissionLabel(item)}</td><td className="p-3">{money(item.platformShare)}</td><td className="p-3">{money(item.vendorShare)}</td><td className="p-3 font-medium">{item.splitStatus}</td><td className="p-3 font-medium">{item.settlementStatus}</td><td className="p-3 text-slate-600">{item.createdAt ? new Date(item.createdAt).toLocaleString() : "—"}</td></tr>)}</tbody></table> : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No settlement allocations found.</p>}
      </div>
    </section>
  </div>;
};

export default SuperAdminSettlementsPage;
