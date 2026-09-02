import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { FiCreditCard, FiFileText, FiPlus, FiPrinter, FiRefreshCw } from "react-icons/fi";
import { addBillPayment, createBill, downloadBillReceipt, getBills, getEligibleBillOrders } from "../../services/billService";
import { currency, dateTime } from "../../utils/format";

const newKey = (prefix) => globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random()}`;
const methods = ["CASH", "UPI", "CREDIT_CARD", "DEBIT_CARD", "NET_BANKING", "WALLET", "OTHER"];
const paymentLabel = (value) => String(value || "").replaceAll("_", " ");

const AdvancedBillingWorkspace = ({ onPaymentRecorded }) => {
  const [eligible, setEligible] = useState([]);
  const [selected, setSelected] = useState([]);
  const [bills, setBills] = useState([]);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [payment, setPayment] = useState({ amount: "", paymentMethod: "CASH", transactionId: "" });
  const createKey = useRef("");
  const paymentKey = useRef("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [eligibleResponse, billsResponse] = await Promise.all([getEligibleBillOrders(), getBills({ page: 1, limit: 20 })]);
      const nextBills = billsResponse.data?.data || [];
      setEligible(eligibleResponse.data?.data || []);
      setBills(nextBills);
      setActive((current) => current ? nextBills.find((bill) => bill._id === current._id) || current : nextBills[0] || null);
    } catch (error) { toast.error(error?.response?.data?.message || "Unable to load billing workspace"); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  const toggle = (orderId) => setSelected((current) => current.includes(orderId) ? current.filter((id) => id !== orderId) : [...current, orderId]);
  const generate = async () => {
    if (!selected.length || saving) return;
    setSaving(true); createKey.current ||= newKey("bill");
    try { const response = await createBill({ orderIds: selected }, createKey.current); setActive(response.data?.data || null); setSelected([]); createKey.current = ""; toast.success(response.data?.message || "Bill generated"); await load(); } catch (error) { toast.error(error?.response?.data?.message || "Unable to generate bill"); } finally { setSaving(false); }
  };
  const submitPayment = async (event) => {
    event.preventDefault(); if (!active?._id || saving) return;
    setSaving(true); paymentKey.current ||= newKey("bill-payment");
    try { const response = await addBillPayment(active._id, { ...payment, amount: Number(payment.amount) }, paymentKey.current); setActive(response.data?.data?.bill || active); setPayment({ amount: "", paymentMethod: "CASH", transactionId: "" }); paymentKey.current = ""; toast.success(response.data?.message || "Payment recorded"); await Promise.all([load(), onPaymentRecorded?.()]); } catch (error) { toast.error(error?.response?.data?.message || "Unable to record payment"); } finally { setSaving(false); }
  };
  const receipt = async (bill) => {
    try { const response = await downloadBillReceipt(bill._id); const url = URL.createObjectURL(response.data); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `receipt-${bill.billNumber}.pdf`; anchor.click(); URL.revokeObjectURL(url); } catch (error) { toast.error(error?.response?.data?.message || "Unable to download receipt"); }
  };
  const paid = Number(active?.paidAmount || 0); const due = Number(active?.balanceDue || 0);

  return (
    <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-4" aria-labelledby="billing-workspace-title">
      <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Cashier workspace</p><h3 id="billing-workspace-title" className="mt-0.5 flex items-center gap-2 text-lg font-bold text-slate-900"><FiFileText className="text-emerald-700" /> Billing</h3><p className="mt-1 text-sm text-slate-500">Generate a bill, then record full, split, or partial payments.</p></div><button type="button" onClick={load} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-3 text-sm font-medium text-slate-700"><FiRefreshCw /> Refresh</button></header>
      <div className="grid gap-3 xl:grid-cols-5">
        <div className="space-y-3 xl:col-span-2">
          <section className="rounded-xl border border-slate-200 p-3"><div className="flex items-center justify-between gap-2"><div><h4 className="font-semibold text-slate-900">Ready to bill</h4><p className="text-xs text-slate-500">Select one or more eligible orders.</p></div><button type="button" disabled={!selected.length || saving} onClick={generate} className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg bg-brand-700 px-3 text-sm font-semibold text-white disabled:opacity-60"><FiPlus /> Generate</button></div><div className="mt-3 max-h-52 space-y-2 overflow-y-auto">{loading ? <div className="h-20 animate-pulse rounded-lg bg-slate-100" /> : eligible.length ? eligible.map((order) => <label key={order._id} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"><span className="flex min-w-0 items-center gap-2"><input type="checkbox" checked={selected.includes(order._id)} onChange={() => toggle(order._id)} /><span className="min-w-0"><strong className="block truncate text-slate-900">#{order.orderNumber}</strong><small className="block text-slate-500">{order.table?.tableNumber ? `Table ${order.table.tableNumber}` : order.orderType}</small></span></span><strong className="shrink-0 text-slate-900">{currency(order.total)}</strong></label>) : <p className="py-4 text-center text-sm text-slate-500">No eligible orders.</p>}</div></section>
          <section className="rounded-xl border border-slate-200 p-3"><h4 className="font-semibold text-slate-900">Recent bills</h4><div className="mt-2 max-h-52 space-y-1.5 overflow-y-auto">{bills.length ? bills.map((bill) => <button type="button" key={bill._id} onClick={() => setActive(bill)} className={`flex min-h-12 w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${active?._id === bill._id ? "bg-brand-50 ring-1 ring-brand-300" : "bg-slate-50 hover:bg-slate-100"}`}><span><strong className="block text-slate-900">{bill.billNumber}</strong><small className="text-slate-500">{bill.table?.tableNumber ? `Table ${bill.table.tableNumber}` : "Takeaway"}</small></span><span className="text-right"><strong className="block text-slate-900">{currency(bill.total)}</strong><small className="text-xs text-slate-500">{paymentLabel(bill.status)}</small></span></button>) : <p className="py-4 text-center text-sm text-slate-500">No bills yet.</p>}</div></section>
        </div>
        {active ? <section className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 sm:p-4 xl:col-span-3"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">{paymentLabel(active.status)}</p><h4 className="mt-0.5 text-lg font-bold text-slate-900">{active.billNumber}</h4><p className="text-sm text-slate-600">{active.table?.tableNumber ? `Table ${active.table.tableNumber}` : "Takeaway"} · {active.allocations?.length || 0} order(s)</p></div><button type="button" onClick={() => receipt(active)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-300 bg-white text-emerald-800" aria-label="Download bill receipt" title="Download receipt"><FiPrinter /></button></div>
          <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-white p-3 text-center"><div><p className="text-[11px] font-semibold uppercase text-slate-500">Total</p><strong className="text-sm text-slate-900">{currency(active.total)}</strong></div><div><p className="text-[11px] font-semibold uppercase text-slate-500">Paid</p><strong className="text-sm text-emerald-700">{currency(paid)}</strong></div><div><p className="text-[11px] font-semibold uppercase text-slate-500">Balance</p><strong className={`text-sm ${due ? "text-amber-700" : "text-emerald-700"}`}>{currency(due)}</strong></div></div>
          <div className="mt-3 space-y-1.5 text-sm"><div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{currency(active.subtotal)}</span></div><div className="flex justify-between text-slate-600"><span>Discount + loyalty</span><span>-{currency(Number(active.discount || 0) + Number(active.loyaltyDiscount || 0))}</span></div><div className="flex justify-between text-slate-600"><span>Tax + service</span><span>{currency(Number(active.tax || 0) + Number(active.serviceCharge || 0))}</span></div><div className="mt-2 flex items-end justify-between rounded-xl bg-slate-900 px-3 py-3 text-white"><span className="text-xs font-semibold uppercase tracking-wide text-slate-300">Grand total</span><strong className="text-2xl">{currency(active.total)}</strong></div></div>
          {(active.payments || []).length ? <div className="mt-3 space-y-1 border-t border-emerald-100 pt-3">{active.payments.map((entry) => <p key={entry._id} className="rounded-lg bg-white px-2.5 py-2 text-xs text-slate-600"><strong className="text-slate-800">{paymentLabel(entry.paymentMethod)}</strong> · {currency(entry.amount)} · {dateTime(entry.paidAt || entry.createdAt)}</p>)}</div> : null}
          {due > 0 ? <form onSubmit={submitPayment} className="mt-4 border-t border-emerald-100 pt-3"><div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]"><input required min="0.01" max={due} step="0.01" type="number" value={payment.amount} onChange={(event) => setPayment((current) => ({ ...current, amount: event.target.value }))} placeholder={`Amount due: ${currency(due)}`} aria-label="Payment amount" className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm" /><input value={payment.transactionId} onChange={(event) => setPayment((current) => ({ ...current, transactionId: event.target.value }))} placeholder="Reference (optional)" aria-label="Payment reference" className="min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm" /></div><div className="ops-scroll-tabs mt-2" aria-label="Payment method">{methods.map((method) => <button type="button" key={method} onClick={() => setPayment((current) => ({ ...current, paymentMethod: method }))} className={`min-h-10 rounded-lg px-3 text-xs font-semibold ${payment.paymentMethod === method ? "bg-brand-700 text-white" : "border border-slate-300 bg-white text-slate-700"}`}>{paymentLabel(method)}</button>)}</div><button disabled={saving || !payment.amount} className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white disabled:opacity-60"><FiCreditCard /> {saving ? "Recording payment…" : `Record ${paymentLabel(payment.paymentMethod)} payment`}</button></form> : <p className="mt-4 rounded-xl bg-emerald-100 px-3 py-3 text-center text-sm font-semibold text-emerald-800">Fully settled</p>}
        </section> : <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 xl:col-span-3">Select or generate a bill to collect payment.</div>}
      </div>
    </section>
  );
};

export default AdvancedBillingWorkspace;
