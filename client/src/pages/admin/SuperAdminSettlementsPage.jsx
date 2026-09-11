import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { fetchRestaurants, fetchSettlementTransactions, getRestaurantCommission, refreshSettlementTransaction, updateRestaurantCommission } from "../../services/superAdminService";

const money = (value) => `₹${Number(value || 0).toFixed(2)}`;
const date = (value) => value ? new Date(value).toLocaleString() : "-";
const commissionLabel = (item) => item.commissionType === "PERCENTAGE"
  ? `${Number(item.commissionValue ?? (item.commissionBps || 0) / 100).toFixed(2).replace(/\.00$/, "")}%`
  : item.commissionType === "FIXED" ? money(item.commissionValue) : "None";
const StatusBadge = ({ value }) => <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">{value || "-"}</span>;

const SuperAdminSettlementsPage = () => {
  const [restaurants, setRestaurants] = useState([]);
  const [restaurantId, setRestaurantId] = useState("");
  const [commission, setCommission] = useState({ commissionType: "NONE", commissionPercentage: 0, fixedAmount: 0 });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [transactionsError, setTransactionsError] = useState("");
  const [refreshingId, setRefreshingId] = useState("");

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
      const { data } = await getRestaurantCommission(restaurantId);
      setCommission(data.data.commission);
      toast.success("Commission saved successfully");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to save commission configuration");
    } finally {
      setLoading(false);
    }
  };

  const refresh = async (id) => {
    if (refreshingId) return;
    setRefreshingId(id);
    try {
      await refreshSettlementTransaction(id);
      await loadTransactions(restaurantId);
      toast.success("Settlement status refreshed");
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to refresh settlement status");
    } finally {
      setRefreshingId("");
    }
  };

  const action = (item) => <button type="button" onClick={() => refresh(item.id)} disabled={Boolean(refreshingId)} className="min-h-9 rounded-lg border border-slate-300 px-3 text-xs font-semibold disabled:opacity-60">{refreshingId === item.id ? "Refreshing..." : "Refresh status"}</button>;
  const details = (item) => <dl className="mt-3 grid grid-cols-2 gap-2 text-xs"><div><dt className="text-slate-500">Gross</dt><dd>{money(item.grossAmount)}</dd></div><div><dt className="text-slate-500">Commission</dt><dd>{commissionLabel(item)}</dd></div><div><dt className="text-slate-500">Platform</dt><dd>{money(item.platformShare)}</dd></div><div><dt className="text-slate-500">Vendor</dt><dd>{money(item.vendorShare)}</dd></div><div><dt className="text-slate-500">Allocation</dt><dd><StatusBadge value={item.splitStatus} /></dd></div><div><dt className="text-slate-500">Settlement</dt><dd><StatusBadge value={item.settlementStatus} /></dd></div><div className="col-span-2"><dt className="text-slate-500">Provider references</dt><dd className="font-mono">{item.providerAllocationReference || item.providerSplitReference || "-"} / {item.providerSettlementReference || item.providerSettlementId || "-"}</dd></div><div><dt className="text-slate-500">UTR</dt><dd className="font-mono">{item.providerUtr || "-"}</dd></div><div><dt className="text-slate-500">Last reconciled</dt><dd>{date(item.lastReconciledAt)}</dd></div></dl>;

  return <div className="space-y-4 pb-20">
    <header><h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Cashfree settlements</h2><p className="mt-1 text-sm text-slate-500">Review provider allocation separately from payment and bank settlement.</p></header>
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><form onSubmit={save} className="grid gap-3 lg:grid-cols-4 lg:items-end"><label className="text-sm font-medium text-slate-700">Restaurant<select value={restaurantId} onChange={(event) => chooseRestaurant(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"><option value="">Select restaurant</option>{restaurants.map((restaurant) => <option value={restaurant._id} key={restaurant._id}>{restaurant.name}</option>)}</select></label><label className="text-sm font-medium text-slate-700">Commission type<select value={commission.commissionType} onChange={(event) => setCommission((value) => ({ ...value, commissionType: event.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"><option value="NONE">No commission</option><option value="PERCENTAGE">Percentage</option><option value="FIXED">Fixed amount</option></select></label>{commission.commissionType === "PERCENTAGE" ? <label className="text-sm font-medium text-slate-700">Percentage<input required min="0" max="100" step="0.01" type="number" value={commission.commissionPercentage} onChange={(event) => setCommission((value) => ({ ...value, commissionPercentage: event.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" /></label> : commission.commissionType === "FIXED" ? <label className="text-sm font-medium text-slate-700">Amount (₹)<input required min="0" step="0.01" type="number" value={commission.fixedAmount} onChange={(event) => setCommission((value) => ({ ...value, fixedAmount: event.target.value }))} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" /></label> : <div />}<button disabled={loading || !restaurantId} className="min-h-11 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white disabled:opacity-60">{loading ? "Saving..." : "Save commission"}</button></form></section>
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold text-slate-900">Allocation and settlement status</h3><p className="mt-1 text-xs text-slate-500">Allocation success does not mean bank settlement is complete.</p></div><button type="button" onClick={() => loadTransactions(restaurantId)} disabled={transactionsLoading} className="min-h-10 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 disabled:opacity-60">Refresh list</button></div>
      {transactionsLoading ? <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">Loading settlement allocations...</p> : transactionsError ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><p>{transactionsError}</p><button type="button" onClick={() => loadTransactions(restaurantId)} className="mt-3 min-h-10 rounded-lg border border-rose-300 bg-white px-3 text-sm font-semibold">Retry</button></div> : <><div className="mt-4 grid gap-3 md:hidden">{transactions.map((item) => <article key={item.id} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-900">{item.restaurantName || "Restaurant"}</p><p className="text-xs text-slate-500">{item.orderNumber || item.order}</p></div>{action(item)}</div>{details(item)}</article>)}</div><div className="mt-4 hidden overflow-x-auto md:block"><table className="min-w-[1450px] w-full text-left text-sm"><thead className="border-b border-slate-200 text-xs uppercase text-slate-500"><tr>{["Restaurant / outlet", "Order", "Gross", "Commission", "Platform", "Vendor", "Strategy", "Allocation", "Settlement", "Provider references", "UTR", "Last reconciled", "Created", "Action"].map((heading) => <th className="p-3" key={heading}>{heading}</th>)}</tr></thead><tbody>{transactions.map((item) => <tr key={item.id} className="border-b border-slate-100 last:border-0"><td className="p-3"><p className="font-medium text-slate-900">{item.restaurantName || "Restaurant"}</p><p className="text-xs text-slate-500">{item.outlet || "-"}</p></td><td className="p-3">{item.orderNumber || item.order}</td><td className="p-3">{money(item.grossAmount)}</td><td className="p-3">{commissionLabel(item)}</td><td className="p-3">{money(item.platformShare)}</td><td className="p-3">{money(item.vendorShare)}</td><td className="p-3">{item.allocationStrategy || "POST_PAYMENT_SPLIT"}</td><td className="p-3"><StatusBadge value={item.splitStatus} /></td><td className="p-3"><StatusBadge value={item.settlementStatus} /></td><td className="p-3 font-mono text-xs">{item.providerAllocationReference || item.providerSplitReference || "-"}<br />{item.providerSettlementReference || item.providerSettlementId || "-"}</td><td className="p-3 font-mono text-xs">{item.providerUtr || "-"}</td><td className="p-3 text-xs">{date(item.lastReconciledAt)}</td><td className="p-3 text-xs">{date(item.createdAt)}</td><td className="p-3">{action(item)}</td></tr>)}</tbody></table></div></>}
    </section>
  </div>;
};

export default SuperAdminSettlementsPage;
