import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { FiCheckCircle, FiDollarSign, FiRefreshCw, FiShield } from "react-icons/fi";
import { closeCashReconciliation, getCashReconciliationPreview, getReconciliationBills, getReconciliationSummary } from "../../services/paymentService";
import { formatCurrency } from "../../utils/paymentUtils";

const Metric = ({ label, value, tone = "text-slate-900" }) => <div className="rounded-xl border border-slate-200 bg-white p-3"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-1 text-xl font-bold ${tone}`}>{value}</p></div>;

const ReconciliationWorkspace = ({ refreshVersion = 0 }) => {
  const [summary, setSummary] = useState(null);
  const [cash, setCash] = useState(null);
  const [bills, setBills] = useState([]);
  const [countedCash, setCountedCash] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryResponse, cashResponse, billsResponse] = await Promise.all([getReconciliationSummary(), getCashReconciliationPreview(), getReconciliationBills({ page: 1, limit: 5 })]);
      setSummary(summaryResponse.data?.data || null);
      setCash(cashResponse.data?.data || null);
      setBills(billsResponse.data?.data || []);
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to load reconciliation data");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load, refreshVersion]);
  const variance = Number(countedCash || 0) - Number(cash?.expectedCash || 0);
  const submit = async (event) => {
    event.preventDefault();
    if (Number.isNaN(Number(countedCash)) || Number(countedCash) < 0) return toast.error("Enter a valid counted cash amount");
    if (Math.abs(variance) > 0.001 && !note.trim()) return toast.error("Add a note for a cash variance");
    setSaving(true);
    try {
      await closeCashReconciliation({ countedCash: Number(countedCash), note: note.trim() });
      toast.success("Cash reconciliation recorded"); setCountedCash(""); setNote(""); await load();
    } catch (error) { toast.error(error?.response?.data?.message || "Unable to close cash reconciliation"); } finally { setSaving(false); }
  };

  return <section className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="flex items-center gap-2 text-lg font-bold text-slate-900"><FiShield className="text-brand-700" />Payment Reconciliation</h3><p className="mt-1 text-sm text-slate-500">Compare recorded bills, received payments and this cashier's cash drawer.</p></div><button onClick={load} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 disabled:opacity-60"><FiRefreshCw />Refresh</button></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Expected bills" value={loading ? "…" : formatCurrency(summary?.expectedAmount)} />
      <Metric label="Net received" value={loading ? "…" : formatCurrency(summary?.receivedAmount)} tone="text-emerald-700" />
      <Metric label="Difference" value={loading ? "…" : formatCurrency(summary?.difference)} tone={Number(summary?.difference || 0) === 0 ? "text-emerald-700" : "text-amber-700"} />
      <Metric label="Unreconciled" value={loading ? "…" : String(summary?.statuses?.UNRECONCILED || 0)} tone="text-amber-700" />
    </div>
    <div className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex items-center justify-between gap-2"><h4 className="font-semibold text-slate-900">Bill comparison</h4><span className="text-xs text-slate-500">Expected vs net received</span></div><div className="mt-2 space-y-2">{loading ? <div className="h-12 animate-pulse rounded-lg bg-slate-100" /> : bills.length ? bills.map((bill) => <div key={bill._id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"><span><strong>{bill.billNumber}</strong><span className="ml-2 text-slate-500">{bill.customer?.fullName || "Guest"}</span></span><span className={bill.reconciliationStatus === "MATCHED" ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>{bill.reconciliationStatus.replaceAll("_", " ")} · {formatCurrency(bill.difference)}</span></div>) : <p className="text-sm text-slate-500">No eligible bills to reconcile.</p>}</div></div>
    <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="flex items-center gap-2 font-semibold text-slate-900"><FiDollarSign />Close your cash drawer</h4><p className="mt-1 text-sm text-slate-500">Shift expected: <strong>{formatCurrency(cash?.expectedCash)}</strong> from {cash?.paymentCount || 0} assigned cash payment(s).</p></div><span className="text-xs text-slate-500">Started {cash?.startedAt ? new Date(cash.startedAt).toLocaleString() : "today"}</span></div><div className="mt-3 grid gap-2 md:grid-cols-[1fr_2fr_auto]"><input required min="0" step="0.01" type="number" value={countedCash} onChange={(event) => setCountedCash(event.target.value)} placeholder="Counted cash" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" /><input value={note} onChange={(event) => setNote(event.target.value)} placeholder={Math.abs(variance) > 0.001 ? "Variance note required" : "Optional note"} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" /><button disabled={saving || loading} className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"><FiCheckCircle />{saving ? "Recording…" : "Close cash"}</button></div>{countedCash !== "" ? <p className={`mt-2 text-sm font-medium ${Math.abs(variance) < 0.001 ? "text-emerald-700" : "text-amber-700"}`}>Drawer variance: {formatCurrency(variance)}</p> : null}</form>
  </section>;
};

export default ReconciliationWorkspace;
