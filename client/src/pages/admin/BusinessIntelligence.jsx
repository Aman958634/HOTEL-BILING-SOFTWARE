import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FiArrowRight, FiBarChart2, FiInfo, FiRefreshCw } from "react-icons/fi";
import { Link } from "react-router-dom";
import EmptyState from "../../components/common/EmptyState";
import { getBusinessIntelligence } from "../../services/businessIntelligenceService";
import { currency } from "../../utils/format";

const ranges = [
  ["today", "Today"], ["yesterday", "Yesterday"], ["last_7_days", "Last 7 Days"], ["last_30_days", "Last 30 Days"], ["this_month", "This Month"], ["last_month", "Last Month"], ["custom", "Custom"],
];

const number = (value) => new Intl.NumberFormat("en-IN").format(Number(value || 0));
const titleCase = (value) => String(value || "").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const Growth = ({ growth }) => {
  const type = growth?.type;
  const label = growth?.label === "New" ? "New activity" : growth?.label === "—" || !growth?.label ? "No comparison" : `${type === "positive" ? "+" : type === "negative" ? "−" : ""}${growth.label} vs previous`;
  return <span className={type === "negative" ? "text-rose-600" : type === "positive" ? "text-emerald-700" : "text-slate-500"}>{label}</span>;
};

const MetricCard = ({ label, metric, currencyValue = true, definition }) => <article className="ops-card min-w-0 p-3 sm:p-4">
  <div className="flex items-start justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>{definition ? <span title={definition} className="shrink-0 text-slate-400"><FiInfo aria-hidden="true" /></span> : null}</div>
  <p className="mt-2 truncate text-xl font-bold tracking-tight text-slate-900 sm:text-2xl" title={String(metric?.current || 0)}>{currencyValue ? currency(metric?.current) : number(metric?.current)}</p>
  <p className="mt-1 text-xs font-medium"><Growth growth={metric?.growth} /></p>
</article>;

const Panel = ({ title, description, action, children }) => <section className="ops-card min-w-0 p-3 sm:p-4">
  <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-base font-bold text-slate-900">{title}</h3>{description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}</div>{action}</div>{children}
</section>;

const BusinessIntelligence = () => {
  const [range, setRange] = useState("last_30_days");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (range === "custom" && (!startDate || !endDate)) return;
    setLoading(true);
    setError("");
    try {
      const response = await getBusinessIntelligence({ range, ...(range === "custom" ? { startDate, endDate } : {}) });
      setData(response.data?.data || null);
    } catch (err) {
      const message = err?.response?.data?.message || "Unable to load business intelligence";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [range, startDate, endDate]);

  useEffect(() => {
    const timer = setTimeout(load, 150);
    return () => clearTimeout(timer);
  }, [load]);

  const overview = data?.overview || {};
  const sales = data?.sales || {};
  const payments = data?.payments || {};
  const menu = data?.menu || {};
  const customers = data?.customers || {};
  const operations = data?.operations || {};
  const hasData = Number(overview.orders?.current || 0) > 0 || Number(payments.transactions || 0) > 0;

  return <div className="space-y-4 pb-20 sm:space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl"><FiBarChart2 aria-hidden="true" />Business Intelligence</h2><p className="mt-1 max-w-2xl text-sm text-slate-500">Compare a selected period with the preceding one, then drill into sales, menu, payments, and operational records.</p></div>
      <button onClick={load} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm disabled:opacity-60"><FiRefreshCw aria-hidden="true" />Refresh</button>
    </header>

    <section className="ops-filter-bar grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Business intelligence period">
      <label className="text-sm font-medium text-slate-700">Period<select value={range} onChange={(event) => setRange(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm">{ranges.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      {range === "custom" ? <><label className="text-sm font-medium text-slate-700">From<input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" /></label><label className="text-sm font-medium text-slate-700">To<input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-sm" /></label></> : null}
      <p className="self-end pb-2 text-xs text-slate-500">Business timezone: {data?.period?.timeZone || "—"}</p>
    </section>

    {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-center"><p className="font-semibold text-rose-700">{error}</p><button onClick={load} className="mt-3 min-h-10 rounded-lg bg-rose-600 px-4 text-sm font-medium text-white">Retry</button></div> : loading ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-100" />)}</div> : !hasData ? <EmptyState icon={<FiBarChart2 className="h-10 w-10" />} title="No business data for this period" description="Try another period or complete orders to begin seeing business insights." /> : <>
      <section aria-labelledby="bi-summary-title"><div className="mb-2 flex items-center justify-between gap-2"><div><h3 id="bi-summary-title" className="text-base font-bold text-slate-900">Performance comparison</h3><p className="text-xs text-slate-500">Current period against the immediately preceding period</p></div><Link to="/dashboard/admin/reports" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">Reports <FiArrowRight aria-hidden="true" /></Link></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><MetricCard label="Gross sales" metric={overview.grossSales} definition={data?.definitions?.grossSales?.formula} /><MetricCard label="Net sales" metric={overview.netSales} definition={data?.definitions?.netSales?.formula} /><MetricCard label="Net collected" metric={overview.netCollected} definition={data?.definitions?.netCollected?.formula} /><MetricCard label="Orders" metric={overview.orders} currencyValue={false} definition="Completed or served non-cancelled orders." /><MetricCard label="Average order value" metric={overview.averageOrderValue} definition={data?.definitions?.averageOrderValue?.formula} /><MetricCard label="Refunds" metric={overview.refunds} definition="Recorded refunded amounts for successful payments." /></div></section>

      <div className="grid gap-4 xl:grid-cols-2"><Panel title="Sales trend" description="Sales recorded across the selected period."><div className="mt-3 h-52 sm:h-64">{sales.trend?.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={sales.trend}><XAxis dataKey="label" tick={{ fontSize: 11 }} minTickGap={24} /><YAxis width={42} tick={{ fontSize: 11 }} /><Tooltip formatter={(value) => currency(value)} /><Bar dataKey="sales" fill="#047857" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer> : <p className="pt-16 text-center text-sm text-slate-500">No sales trend for this period.</p>}</div></Panel><Panel title="Order source mix" description="Order count and sales by recorded source."><div className="mt-3 space-y-2">{sales.sources?.length ? sales.sources.map((row) => <div key={row.source} className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm"><span className="truncate font-medium text-slate-700">{titleCase(row.source)}</span><strong className="shrink-0 text-right text-slate-900">{number(row.orders)} orders · {currency(row.sales)}</strong></div>) : <p className="text-sm text-slate-500">No order-source data.</p>}</div></Panel></div>

      <div className="grid gap-4 xl:grid-cols-2"><Panel title="Top menu items" description="Ranked by quantity sold in the selected period."><div className="mt-3 space-y-2">{menu.topItems?.length ? menu.topItems.map((row, index) => <div key={`${row.item}-${row.category}`} className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm"><span className="min-w-0 truncate"><strong className="text-slate-900">{index + 1}. {row.item}</strong><small className="ml-2 text-slate-500">{row.category}</small></span><span className="shrink-0 text-right text-slate-700">{number(row.quantity)} units · <strong>{currency(row.sales)}</strong></span></div>) : <p className="text-sm text-slate-500">No item sales.</p>}</div></Panel><Panel title="Payment & reconciliation" description="Existing settlement and exception counts."><div className="mt-3 space-y-2">{payments.paymentMix?.length ? payments.paymentMix.map((row) => <div key={row.method} className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm"><span className="truncate font-medium text-slate-700">{titleCase(row.method)}</span><strong className="shrink-0 text-right text-slate-900">{currency(row.amount)} · {number(row.transactions)} txns</strong></div>) : <p className="text-sm text-slate-500">No payment mix data.</p>}<div className="grid grid-cols-3 gap-2 pt-1 text-center text-xs text-slate-600"><span className="rounded-lg bg-slate-50 px-2 py-2">Unreconciled<br /><strong className="text-slate-900">{number(payments.reconciliation?.unreconciledPayments)}</strong></span><span className="rounded-lg bg-slate-50 px-2 py-2">Cash mismatches<br /><strong className="text-slate-900">{number(payments.reconciliation?.cashMismatchCount)}</strong></span><span className="rounded-lg bg-slate-50 px-2 py-2">Pending refunds<br /><strong className="text-slate-900">{number(payments.reconciliation?.pendingRefunds)}</strong></span></div></div></Panel></div>

      <div className="grid gap-4 lg:grid-cols-3"><Panel title="Customers"><div className="mt-3 grid grid-cols-2 gap-3 text-sm text-slate-600"><p>Identified<br /><strong className="text-slate-900">{number(customers.identifiedCustomers)}</strong></p><p>New<br /><strong className="text-slate-900">{number(customers.newCustomers)}</strong></p><p>Returning<br /><strong className="text-slate-900">{number(customers.returningCustomers)}</strong></p><p>Repeat rate<br /><strong className="text-slate-900">{number(customers.repeatRate)}%</strong></p></div></Panel><Panel title="Operations"><div className="mt-3 space-y-2 text-sm text-slate-600"><p>Peak hours: <strong className="text-slate-900">{sales.peakHours?.map((row) => `${String(row.hour).padStart(2, "0")}:00`).join(", ") || "—"}</strong></p><p>KOT timestamp quality: <strong className="text-slate-900">{operations.kitchen?.preparationTimeAvailable ? "available" : "duration unavailable"}</strong></p><p>Tables with completed orders: <strong className="text-slate-900">{number(operations.tables?.length)}</strong></p></div></Panel><Panel title="Inventory data quality"><div className="mt-3 space-y-2 text-sm text-slate-600"><p>Current stock value: <strong className="text-slate-900">{currency(operations.inventory?.currentStockValue)}</strong></p><p>Low stock: <strong className="text-slate-900">{number(operations.inventory?.lowStockCount)}</strong></p><p className="text-xs text-slate-500">{operations.inventory?.note}</p></div></Panel></div>
    </>}</div>;
};

export default BusinessIntelligence;
