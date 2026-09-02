import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FiAlertTriangle, FiCheckCircle, FiDollarSign, FiRefreshCw, FiShield } from "react-icons/fi";
import { closeCashReconciliation, getCashReconciliationPreview, getReconciliationBills, getReconciliationSummary } from "../../services/paymentService";
import { formatCurrency } from "../../utils/paymentUtils";

const Metric = ({ label, value, tone = "text-slate-900" }) => <div className="ops-card min-w-0 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-1 truncate text-xl font-bold ${tone}`}>{value}</p></div>;
const statusLabel = (value) => String(value || "UNRECONCILED").replaceAll("_", " ");

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
  const needsReview = useMemo(() => bills.filter((bill) => bill.reconciliationStatus !== "MATCHED"), [bills]);

  const submit = async (event) => {
    event.preventDefault();
    if (Number.isNaN(Number(countedCash)) || Number(countedCash) < 0) return toast.error("Enter a valid counted cash amount");
    if (Math.abs(variance) > 0.001 && !note.trim()) return toast.error("Add a note for a cash variance");
    setSaving(true);
    try {
      await closeCashReconciliation({ countedCash: Number(countedCash), note: note.trim() });
      toast.success("Cash reconciliation recorded");
      setCountedCash("");
      setNote("");
      await load();
    } catch (error) { toast.error(error?.response?.data?.message || "Unable to close cash reconciliation"); }
    finally { setSaving(false); }
  };

  return <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 shadow-sm sm:rounded-2xl sm:p-4" aria-labelledby="reconciliation-title">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Finance operations</p><h3 id="reconciliation-title" className="mt-0.5 flex items-center gap-2 text-lg font-bold text-slate-900"><FiShield className="text-brand-700" aria-hidden="true" />Payment reconciliation</h3><p className="mt-1 text-sm text-slate-500">Compare recorded bills, received payments, and the assigned cash drawer.</p></div><button type="button" onClick={load} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 disabled:opacity-60"><FiRefreshCw aria-hidden="true" />Refresh</button></header>

    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Reconciliation summary"><Metric label="Expected bills" value={loading ? "…" : formatCurrency(summary?.expectedAmount)} /><Metric label="Net received" value={loading ? "…" : formatCurrency(summary?.receivedAmount)} tone="text-emerald-700" /><Metric label="Difference" value={loading ? "…" : formatCurrency(summary?.difference)} tone={Number(summary?.difference || 0) === 0 ? "text-emerald-700" : "text-amber-700"} /><Metric label="Unreconciled" value={loading ? "…" : String(summary?.statuses?.UNRECONCILED || 0)} tone="text-amber-700" /></section>

    {!loading && needsReview.length ? <section className="rounded-xl border border-amber-200 bg-amber-50 p-3" aria-labelledby="reconciliation-attention-title"><div className="flex flex-wrap items-start justify-between gap-2"><div><h4 id="reconciliation-attention-title" className="flex items-center gap-2 font-bold text-amber-900"><FiAlertTriangle aria-hidden="true" />Needs review</h4><p className="mt-0.5 text-xs text-amber-800">Existing bill reconciliation statuses that are not matched.</p></div><span className="text-xs font-semibold text-amber-800">{needsReview.length} shown</span></div><div className="mt-2 grid gap-2 lg:grid-cols-2">{needsReview.map((bill) => <div key={bill._id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white px-3 py-2.5"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{bill.billNumber}</p><p className="mt-0.5 truncate text-xs text-slate-600">Expected {formatCurrency(bill.total)} · Received {formatCurrency(bill.paidAmount)}</p></div><span className="shrink-0 text-right text-xs font-semibold text-amber-800">{statusLabel(bill.reconciliationStatus)}<br />{formatCurrency(bill.difference)}</span></div>)}</div></section> : null}

    <section className="rounded-xl border border-slate-200 bg-white p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><h4 className="font-bold text-slate-900">Bill comparison</h4><p className="mt-0.5 text-xs text-slate-500">Expected and net-received amounts from current reconciliation records.</p></div><span className="text-xs text-slate-500">{bills.length} recent bill{bills.length === 1 ? "" : "s"}</span></div><div className="mt-3 space-y-2">{loading ? <div className="h-12 animate-pulse rounded-lg bg-slate-100" /> : bills.length ? bills.map((bill) => <div key={bill._id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2.5 text-sm"><span className="min-w-0"><strong className="block truncate text-slate-900">{bill.billNumber}</strong><span className="text-xs text-slate-500">{bill.customer?.fullName || "Guest"} · Expected {formatCurrency(bill.total)} · Received {formatCurrency(bill.paidAmount)}</span></span><span className={bill.reconciliationStatus === "MATCHED" ? "shrink-0 text-right text-xs font-semibold text-emerald-700" : "shrink-0 text-right text-xs font-semibold text-amber-700"}>{statusLabel(bill.reconciliationStatus)}<br />{formatCurrency(bill.difference)}</span></div>) : <p className="py-2 text-sm text-slate-500">No eligible bills to reconcile.</p>}</div></section>

    <form onSubmit={submit} className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="flex items-center gap-2 font-bold text-slate-900"><FiDollarSign aria-hidden="true" />Close your cash drawer</h4><p className="mt-1 text-sm text-slate-500">Shift expected: <strong className="text-slate-800">{formatCurrency(cash?.expectedCash)}</strong> from {cash?.paymentCount || 0} assigned cash payment(s).</p></div><span className="text-xs text-slate-500">Started {cash?.startedAt ? new Date(cash.startedAt).toLocaleString() : "today"}</span></div><div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]"><label className="sr-only" htmlFor="counted-cash">Counted cash</label><input id="counted-cash" required min="0" step="0.01" type="number" value={countedCash} onChange={(event) => setCountedCash(event.target.value)} placeholder="Counted cash" className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm" /><label className="sr-only" htmlFor="cash-note">Variance note</label><input id="cash-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder={Math.abs(variance) > 0.001 ? "Variance note required" : "Optional note"} className="min-h-11 rounded-xl border border-slate-300 px-3 text-sm" /><button disabled={saving || loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white disabled:opacity-60"><FiCheckCircle aria-hidden="true" />{saving ? "Recording…" : "Close cash"}</button></div>{countedCash !== "" ? <p className={`mt-2 text-sm font-medium ${Math.abs(variance) < 0.001 ? "text-emerald-700" : "text-amber-700"}`}>Drawer variance: {formatCurrency(variance)}</p> : null}</form>
  </section>;
};

export default ReconciliationWorkspace;
