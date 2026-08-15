import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { FiDownload, FiFileText, FiFilter, FiRefreshCw, FiUsers } from "react-icons/fi";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import StatCard from "../../components/admin/StatCard";
import { currency, dateTime } from "../../utils/format";
import {
  exportReports,
  getReportsCategories,
  getReportsCustomers,
  getReportsOrders,
  getReportsPayments,
  getReportsRevenue,
  getReportsSales,
  getReportsSummary,
  getReportsTopItems,
} from "../../services/reportsService";

const RANGE_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this_week", label: "This Week" },
  { value: "last_week", label: "Last Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_year", label: "This Year" },
  { value: "custom", label: "Custom" },
];

const ORDER_STATUS_OPTIONS = ["", "PENDING", "CONFIRMED", "PREPARING", "READY", "COMPLETED", "CANCELLED"];
const PAYMENT_STATUS_OPTIONS = ["", "PENDING", "PROCESSING", "PAID", "FAILED", "REFUNDED", "PARTIALLY_REFUNDED"];

const defaultFilters = {
  range: "this_month",
  startDate: "",
  endDate: "",
  page: 1,
  limit: 10,
  search: "",
  orderStatus: "",
  paymentStatus: "",
  sortBy: "date",
  sortOrder: "desc",
};

const chartColors = ["#0f766e", "#0ea5e9", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6", "#334155"];

const toneByGrowth = (value) => {
  if (Number(value || 0) > 0) return "text-emerald-600";
  if (Number(value || 0) < 0) return "text-red-600";
  return "text-slate-500";
};

const paymentLabel = (value) =>
  String(value || "")
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const Reports = () => {
  const [filters, setFilters] = useState(defaultFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [summary, setSummary] = useState(null);
  const [revenue, setRevenue] = useState({ points: [], totalRevenue: 0 });
  const [orders, setOrders] = useState({ statusBreakdown: [] });
  const [topItems, setTopItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [payments, setPayments] = useState({ summary: {}, methods: [] });
  const [customers, setCustomers] = useState(null);
  const [salesRows, setSalesRows] = useState([]);
  const [salesMeta, setSalesMeta] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });

  const filtersRef = useRef(filters);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const reportQuery = useMemo(() => {
    const params = { range: filters.range };
    if (filters.range === "custom") {
      params.startDate = filters.startDate || undefined;
      params.endDate = filters.endDate || undefined;
    }
    return params;
  }, [filters.range, filters.startDate, filters.endDate]);

  const salesQuery = useMemo(
    () => ({
      ...reportQuery,
      page: filters.page,
      limit: filters.limit,
      search: filters.search || undefined,
      orderStatus: filters.orderStatus || undefined,
      paymentStatus: filters.paymentStatus || undefined,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
    }),
    [reportQuery, filters.page, filters.limit, filters.search, filters.orderStatus, filters.paymentStatus, filters.sortBy, filters.sortOrder]
  );

  const loadAll = async (nextReportQuery = reportQuery, nextSalesQuery = salesQuery) => {
    if (nextReportQuery.range === "custom" && (!nextReportQuery.startDate || !nextReportQuery.endDate)) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [summaryRes, revenueRes, ordersRes, topItemsRes, categoriesRes, paymentsRes, customersRes, salesRes] = await Promise.all([
        getReportsSummary(nextReportQuery),
        getReportsRevenue(nextReportQuery),
        getReportsOrders(nextReportQuery),
        getReportsTopItems(nextReportQuery),
        getReportsCategories(nextReportQuery),
        getReportsPayments(nextReportQuery),
        getReportsCustomers(nextReportQuery),
        getReportsSales(nextSalesQuery),
      ]);

      setSummary(summaryRes.data.data || null);
      setRevenue(revenueRes.data.data || { points: [], totalRevenue: 0 });
      setOrders(ordersRes.data.data || { statusBreakdown: [] });
      setTopItems(topItemsRes.data.data || []);
      setCategories(categoriesRes.data.data || []);
      setPayments(paymentsRes.data.data || { summary: {}, methods: [] });
      setCustomers(customersRes.data.data || null);
      setSalesRows(salesRes.data.data || []);
      setSalesMeta(salesRes.data.meta || { total: 0, page: 1, limit: 10, totalPages: 1 });
    } catch (err) {
      const message = err?.response?.data?.message || "Unable to load reports";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadAll(reportQuery, salesQuery);
    }, 200);
    return () => clearTimeout(timer);
  }, [reportQuery, salesQuery]);

  const updateFilters = (patch) => {
    setFilters((current) => ({
      ...current,
      ...patch,
    }));
  };

  const onRangeChange = (range) => {
    setFilters((current) => ({
      ...current,
      range,
      page: 1,
      startDate: range === "custom" ? current.startDate : "",
      endDate: range === "custom" ? current.endDate : "",
    }));
  };

  const onExport = async (format) => {
    if (reportQuery.range === "custom" && (!reportQuery.startDate || !reportQuery.endDate)) {
      toast.error("Select start and end date for custom range");
      return;
    }

    try {
      const { data } = await exportReports({ ...reportQuery, format });
      const blobUrl = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `reports-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
      toast.success(`Reports exported as ${format.toUpperCase()}`);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Unable to export reports");
    }
  };

  const summaryCards = useMemo(() => {
    if (!summary) return [];
    return [
      {
        label: "Total Revenue",
        value: summary.totalRevenue || 0,
        trend: summary.growth?.totalRevenue || 0,
        formatValue: true,
      },
      {
        label: "Total Orders",
        value: summary.totalOrders || 0,
        trend: summary.growth?.totalOrders || 0,
        formatValue: false,
      },
      {
        label: "Avg Order Value",
        value: summary.averageOrderValue || 0,
        trend: summary.growth?.averageOrderValue || 0,
        formatValue: true,
      },
      {
        label: "Customers",
        value: summary.totalCustomers || 0,
        trend: summary.growth?.totalCustomers || 0,
        formatValue: false,
      },
      {
        label: "Completed Orders",
        value: summary.completedOrders || 0,
        trend: summary.growth?.completedOrders || 0,
        formatValue: false,
      },
      {
        label: "Cancelled Orders",
        value: summary.cancelledOrders || 0,
        trend: summary.growth?.cancelledOrders || 0,
        formatValue: false,
      },
    ];
  }, [summary]);

  const paymentMethodChart = useMemo(
    () => (payments?.methods || []).map((row) => ({ name: paymentLabel(row.method), value: row.totalAmount || 0, count: row.count || 0 })),
    [payments]
  );

  const orderStatusChart = useMemo(
    () => (orders?.statusBreakdown || []).map((row) => ({ name: paymentLabel(row.status), value: row.count || 0, percent: row.percent || 0 })),
    [orders]
  );

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Reports & Analytics</h2>
            <p className="mt-1 text-sm text-slate-500">Real-time revenue, orders, customer and payment insights.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => loadAll(reportQuery, salesQuery)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700"
            >
              <FiRefreshCw /> Refresh
            </button>
            <button
              onClick={() => onExport("csv")}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2 text-sm font-medium text-white shadow-sm"
            >
              <FiDownload /> CSV
            </button>
            <button
              onClick={() => onExport("pdf")}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700"
            >
              <FiFileText /> PDF
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Range</label>
            <div className="relative">
              <FiFilter className="pointer-events-none absolute left-3 top-3 text-slate-400" />
              <select
                value={filters.range}
                onChange={(e) => onRangeChange(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-700"
              >
                {RANGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filters.range === "custom" && (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Start Date</label>
                <input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => updateFilters({ startDate: e.target.value, page: 1 })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">End Date</label>
                <input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => updateFilters({ endDate: e.target.value, page: 1 })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                />
              </div>
            </>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Search (Sales Table)</label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => updateFilters({ search: e.target.value, page: 1 })}
              placeholder="Order ID / customer"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            />
          </div>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Order Status</label>
            <select
              value={filters.orderStatus}
              onChange={(e) => updateFilters({ orderStatus: e.target.value, page: 1 })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            >
              {ORDER_STATUS_OPTIONS.map((value) => (
                <option key={value || "all"} value={value}>
                  {value ? paymentLabel(value) : "All"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Payment Status</label>
            <select
              value={filters.paymentStatus}
              onChange={(e) => updateFilters({ paymentStatus: e.target.value, page: 1 })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            >
              {PAYMENT_STATUS_OPTIONS.map((value) => (
                <option key={value || "all"} value={value}>
                  {value ? paymentLabel(value) : "All"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Sort By</label>
            <select
              value={filters.sortBy}
              onChange={(e) => updateFilters({ sortBy: e.target.value, page: 1 })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            >
              <option value="date">Date</option>
              <option value="revenue">Revenue</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Sort Order</label>
            <select
              value={filters.sortOrder}
              onChange={(e) => updateFilters({ sortOrder: e.target.value, page: 1 })}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-center shadow-sm">
          <p className="text-lg font-semibold text-rose-700">Unable to load reports</p>
          <p className="mt-1 text-sm text-rose-600">{error}</p>
          <button
            onClick={() => loadAll(reportQuery, salesQuery)}
            className="mt-4 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white"
          >
            Try Again
          </button>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-100" />)
          : summaryCards.map((card) => (
              <StatCard
                key={card.label}
                icon={<FiUsers />}
                label={card.label}
                value={card.value}
                trend={card.trend}
                formatValue={card.formatValue}
              />
            ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Revenue Trend</h3>
            <p className="text-sm text-slate-500">{currency(revenue.totalRevenue || 0)}</p>
          </div>
          <div className="mt-4 h-72">
            {loading ? (
              <div className="h-full animate-pulse rounded-xl bg-slate-100" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenue.points || []}>
                  <XAxis dataKey="label" hide={false} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => currency(value)} />
                  <Bar dataKey="revenue" radius={[8, 8, 0, 0]} fill="#0f766e" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Order Status Mix</h3>
          <div className="mt-4 h-72">
            {loading ? (
              <div className="h-full animate-pulse rounded-xl bg-slate-100" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={orderStatusChart} dataKey="value" nameKey="name" outerRadius={90} innerRadius={50} paddingAngle={3}>
                    {orderStatusChart.map((entry, index) => (
                      <Cell key={`${entry.name}-${index}`} fill={chartColors[index % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, _name, context) => [`${value} orders (${context?.payload?.percent || 0}%)`, "Orders"]} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Payment Methods</h3>
          <div className="mt-4 h-72">
            {loading ? (
              <div className="h-full animate-pulse rounded-xl bg-slate-100" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={paymentMethodChart}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => currency(value)} />
                  <Bar dataKey="value" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          {!loading && payments?.summary ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <p className="text-sm text-slate-600">Total Payments: <span className="font-semibold text-slate-900">{payments.summary.totalPayments || 0}</span></p>
              <p className="text-sm text-slate-600">Successful: <span className="font-semibold text-emerald-600">{payments.summary.successfulPayments || 0}</span></p>
              <p className="text-sm text-slate-600">Pending: <span className="font-semibold text-amber-600">{payments.summary.pendingPayments || 0}</span></p>
              <p className="text-sm text-slate-600">Failed/Refunded: <span className="font-semibold text-rose-600">{(payments.summary.failedPayments || 0) + (payments.summary.refundedPayments || 0)}</span></p>
            </div>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-900">Customer Analytics</h3>
          {loading ? (
            <div className="mt-4 h-72 animate-pulse rounded-xl bg-slate-100" />
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Total Customers</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{customers?.totalCustomers || 0}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">New Customers</p>
                <p className="mt-2 text-2xl font-bold text-emerald-700">{customers?.newCustomers || 0}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Returning Customers</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{customers?.returningCustomers || 0}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">Avg Spend / Customer</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{currency(customers?.averageCustomerSpend || 0)}</p>
              </div>
            </div>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Top Selling Items</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Rank</th>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Quantity Sold</th>
                <th className="px-3 py-2">Orders</th>
                <th className="px-3 py-2">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <tr key={index} className="border-b border-slate-100">
                    <td colSpan={6} className="px-3 py-3">
                      <div className="h-4 animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))
              ) : topItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-slate-500">No item sales found for selected range.</td>
                </tr>
              ) : (
                topItems.map((row) => (
                  <tr key={`${row.rank}-${row.itemName}`} className="border-b border-slate-100">
                    <td className="px-3 py-3 font-medium text-slate-800">#{row.rank}</td>
                    <td className="px-3 py-3 text-slate-700">{row.itemName}</td>
                    <td className="px-3 py-3 text-slate-600">{row.category}</td>
                    <td className="px-3 py-3 text-slate-700">{row.quantitySold}</td>
                    <td className="px-3 py-3 text-slate-700">{row.orders}</td>
                    <td className="px-3 py-3 font-medium text-slate-900">{currency(row.revenue || 0)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Category Performance</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Orders</th>
                <th className="px-3 py-2">Items Sold</th>
                <th className="px-3 py-2">Revenue</th>
                <th className="px-3 py-2">Sales %</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <tr key={index} className="border-b border-slate-100">
                    <td colSpan={5} className="px-3 py-3">
                      <div className="h-4 animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))
              ) : categories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-slate-500">No category data found for selected range.</td>
                </tr>
              ) : (
                categories.map((row) => (
                  <tr key={row.category} className="border-b border-slate-100">
                    <td className="px-3 py-3 text-slate-800">{row.category}</td>
                    <td className="px-3 py-3 text-slate-700">{row.orders}</td>
                    <td className="px-3 py-3 text-slate-700">{row.itemsSold}</td>
                    <td className="px-3 py-3 text-slate-900">{currency(row.revenue || 0)}</td>
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">{row.salesPercent || 0}%</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-semibold text-slate-900">Sales Report</h3>
          <p className="text-sm text-slate-500">{salesMeta.total || 0} rows</p>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Order ID</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Customer</th>
                <th className="px-3 py-2">Items</th>
                <th className="px-3 py-2">Subtotal</th>
                <th className="px-3 py-2">Discount</th>
                <th className="px-3 py-2">Tax</th>
                <th className="px-3 py-2">Total</th>
                <th className="px-3 py-2">Payment</th>
                <th className="px-3 py-2">Order Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 10 }).map((_, index) => (
                  <tr key={index} className="border-b border-slate-100">
                    <td colSpan={10} className="px-3 py-3">
                      <div className="h-4 animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))
              ) : salesRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-8 text-center text-slate-500">No sales rows found for selected filters.</td>
                </tr>
              ) : (
                salesRows.map((row) => (
                  <tr key={row._id} className="border-b border-slate-100">
                    <td className="px-3 py-3 font-medium text-slate-800">{row.orderNumber}</td>
                    <td className="px-3 py-3 text-slate-600">{dateTime(row.createdAt)}</td>
                    <td className="px-3 py-3 text-slate-700">{row.customerName}</td>
                    <td className="px-3 py-3 text-slate-700">{row.itemsCount}</td>
                    <td className="px-3 py-3 text-slate-700">{currency(row.subtotal || 0)}</td>
                    <td className="px-3 py-3 text-slate-700">{currency(row.discount || 0)}</td>
                    <td className="px-3 py-3 text-slate-700">{currency(row.tax || 0)}</td>
                    <td className="px-3 py-3 font-semibold text-slate-900">{currency(row.total || 0)}</td>
                    <td className="px-3 py-3">
                      <span className="block text-slate-700">{paymentLabel(row.paymentMethod)}</span>
                      <span className={`text-xs font-semibold ${toneByGrowth(row.paymentStatus === "PAID" ? 1 : row.paymentStatus === "FAILED" ? -1 : 0)}`}>
                        {paymentLabel(row.paymentStatus)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-700">{paymentLabel(row.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            Page {salesMeta.page || 1} of {salesMeta.totalPages || 1}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => updateFilters({ page: Math.max((filtersRef.current.page || 1) - 1, 1) })}
              disabled={(salesMeta.page || 1) <= 1 || loading}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Prev
            </button>
            <button
              onClick={() => updateFilters({ page: Math.min((filtersRef.current.page || 1) + 1, salesMeta.totalPages || 1) })}
              disabled={(salesMeta.page || 1) >= (salesMeta.totalPages || 1) || loading}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Reports;
