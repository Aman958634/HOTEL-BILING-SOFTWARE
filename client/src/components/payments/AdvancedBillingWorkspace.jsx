import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { FiFileText, FiPlus, FiPrinter, FiRefreshCw } from "react-icons/fi";
import { addBillPayment, createBill, downloadBillReceipt, getBills, getEligibleBillOrders } from "../../services/billService";
import { currency, dateTime } from "../../utils/format";

const newKey = (prefix) => globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random()}`;
const methods = ["CASH", "UPI", "CREDIT_CARD", "DEBIT_CARD", "NET_BANKING", "WALLET", "OTHER"];

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
    } catch (error) {
      toast.error(error?.response?.data?.message || "Unable to load billing workspace");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  const toggle = (orderId) => setSelected((current) => current.includes(orderId) ? current.filter((id) => id !== orderId) : [...current, orderId]);
  const generate = async () => {
    if (!selected.length) return;
    setSaving(true); createKey.current ||= newKey("bill");
    try {
      const response = await createBill({ orderIds: selected }, createKey.current);
      setActive(response.data?.data || null); setSelected([]); createKey.current = "";
      toast.success(response.data?.message || "Bill generated"); await load();
    } catch (error) { toast.error(error?.response?.data?.message || "Unable to generate bill"); } finally { setSaving(false); }
  };
  const submitPayment = async (event) => {
    event.preventDefault(); if (!active?._id) return;
    setSaving(true); paymentKey.current ||= newKey("bill-payment");
    try {
      const response = await addBillPayment(active._id, { ...payment, amount: Number(payment.amount) }, paymentKey.current);
      setActive(response.data?.data?.bill || active); setPayment({ amount: "", paymentMethod: "CASH", transactionId: "" }); paymentKey.current = "";
      toast.success(response.data?.message || "Payment recorded");
      await Promise.all([load(), onPaymentRecorded?.()]);
    } catch (error) { toast.error(error?.response?.data?.message || "Unable to record payment"); } finally { setSaving(false); }
  };
  const receipt = async (bill) => {
    try {
      const response = await downloadBillReceipt(bill._id); const url = URL.createObjectURL(response.data); const anchor = document.createElement("a");
      anchor.href = url; anchor.download = `receipt-${bill.billNumber}.pdf`; anchor.click(); URL.revokeObjectURL(url);
    } catch (error) { toast.error(error?.response?.data?.message || "Unable to download receipt"); }
  };
  const paid = Number(active?.paidAmount || 0); const due = Number(active?.balanceDue || 0);

  return (
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="flex items-center gap-2 text-lg font-bold text-slate-900"><FiFileText className="text-emerald-700" />Advanced Billing</h3><p className="mt-1 text-sm text-slate-500">Consolidate eligible table orders, then collect partial or split payments.</p></div><button onClick={load} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"><FiRefreshCw />Refresh</button></div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 p-3"><div className="flex items-center justify-between gap-2"><h4 className="font-semibold text-slate-900">Eligible orders</h4><button disabled={!selected.length || saving} onClick={generate} className="inline-flex items-center gap-1 rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"><FiPlus />Generate bill</button></div><div className="mt-3 max-h-72 space-y-2 overflow-y-auto">{loading ? <div className="h-20 animate-pulse rounded-lg bg-slate-100" /> : eligible.length ? eligible.map((order) => <label key={order._id} className="flex cursor-pointer items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm"><span className="flex items-center gap-2"><input type="checkbox" checked={selected.includes(order._id)} onChange={() => toggle(order._id)} /><span><strong>#{order.orderNumber}</strong><small className="ml-2 text-slate-500">{order.table?.tableNumber ? `Table ${order.table.tableNumber}` : order.orderType}</small></span></span><strong>{currency(order.total)}</strong></label>) : <p className="text-sm text-slate-500">No unbilled eligible orders.</p>}</div></div>
          <div className="rounded-xl border border-slate-200 p-3"><h4 className="font-semibold text-slate-900">Bill history</h4><div className="mt-3 max-h-72 space-y-2 overflow-y-auto">{bills.length ? bills.map((bill) => <button key={bill._id} onClick={() => setActive(bill)} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${active?._id === bill._id ? "bg-emerald-50 ring-1 ring-emerald-300" : "bg-slate-50"}`}><span><strong>{bill.billNumber}</strong><small className="ml-2 text-slate-500">{bill.table?.tableNumber ? `Table ${bill.table.tableNumber}` : "Takeaway"}</small></span><span className="text-right"><strong>{currency(bill.total)}</strong><small className="block text-xs text-slate-500">{bill.status.replaceAll("_", " ")}</small></span></button>) : <p className="text-sm text-slate-500">No bills yet.</p>}</div></div>
        </div>
        {active ? <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-slate-900">{active.billNumber}</p><p className="text-sm text-slate-600">{active.allocations?.length || 0} original order(s) · {active.status.replaceAll("_", " ")}</p></div><button onClick={() => receipt(active)} className="rounded-lg border border-emerald-300 p-2 text-emerald-800" aria-label="Download receipt"><FiPrinter /></button></div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><div><p className="text-xs text-slate-500">Grand total</p><strong>{currency(active.total)}</strong></div><div><p className="text-xs text-slate-500">Paid</p><strong>{currency(paid)}</strong></div><div><p className="text-xs text-slate-500">Balance</p><strong className={due ? "text-amber-700" : "text-emerald-700"}>{currency(due)}</strong></div></div><div className="mt-4 space-y-1 border-t border-emerald-100 pt-3 text-sm text-slate-700"><p>Subtotal {currency(active.subtotal)} · Discount {currency(active.discount)} · Loyalty {currency(active.loyaltyDiscount)} · Tax {currency(active.tax)} · Service {currency(active.serviceCharge)}</p>{(active.payments || []).map((entry) => <p key={entry._id} className="rounded bg-white px-2 py-1">{entry.paymentMethod.replaceAll("_", " ")} · {currency(entry.amount)} · {dateTime(entry.paidAt || entry.createdAt)}</p>)}</div>{due > 0 ? <form onSubmit={submitPayment} className="mt-4 grid gap-2 sm:grid-cols-3"><input required min="0.01" max={due} step="0.01" type="number" value={payment.amount} onChange={(event) => setPayment((current) => ({ ...current, amount: event.target.value }))} placeholder={`Due ${due.toFixed(2)}`} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" /><select value={payment.paymentMethod} onChange={(event) => setPayment((current) => ({ ...current, paymentMethod: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">{methods.map((method) => <option key={method} value={method}>{method.replaceAll("_", " ")}</option>)}</select><button disabled={saving} className="rounded-lg bg-brand-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">Add payment</button></form> : <p className="mt-4 rounded-lg bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-800">Fully settled</p>}</div> : <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Select or generate a bill to collect payment.</div>}
      </div>
    </section>
  );
};

export default AdvancedBillingWorkspace;
