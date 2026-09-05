import { useEffect, useState } from "react";
import { FiBox, FiCheckCircle, FiCreditCard, FiGlobe, FiMail, FiRefreshCw, FiTruck, FiWifi } from "react-icons/fi";
import RequestState from "../../components/common/RequestState";
import { getIntegrationStatus } from "../../services/restaurantService";

const icons = { Payments: FiCreditCard, Communication: FiMail, Media: FiBox, Ordering: FiTruck, Infrastructure: FiWifi };
const statusClass = { Configured: "border-emerald-200 bg-emerald-50 text-emerald-800", Unavailable: "border-slate-200 bg-slate-50 text-slate-600" };

const IntegrationsPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getIntegrationStatus();
      setData(response.data?.data || null);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to load integration status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="space-y-4 pb-20"><div className="h-24 animate-pulse rounded-2xl bg-slate-100" /><div className="grid gap-3 md:grid-cols-2">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-36 animate-pulse rounded-2xl bg-slate-100" />)}</div></div>;
  if (error) return <RequestState title="Integrations are unavailable" message={error} onRetry={load} />;

  return <div className="space-y-5 pb-20">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Integrations</h2><p className="mt-1 text-sm text-slate-500">Server-reported provider configuration and operational capabilities.</p></div>
      <button type="button" onClick={load} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700"><FiRefreshCw aria-hidden="true" />Refresh</button>
    </header>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {(data?.integrations || []).map((integration) => { const Icon = icons[integration.category] || FiGlobe; return <article key={integration.id} className="ops-card min-w-0 p-4"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><Icon aria-hidden="true" /></span><div className="min-w-0"><h3 className="truncate font-semibold text-slate-900">{integration.name}</h3><p className="text-xs text-slate-500">{integration.category}</p></div></div><span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass[integration.status] || statusClass.Unavailable}`}>{integration.status}</span></div><p className="mt-3 text-sm text-slate-600">{integration.detail}</p><p className="mt-3 text-xs text-slate-500">Scope: {integration.scope}</p>{integration.id === "qr-ordering" ? <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-700"><FiCheckCircle aria-hidden="true" />Signed context enabled</p> : null}</article>; })}
    </div>
    <section className="ops-card border-slate-200 bg-slate-50 p-4" aria-labelledby="unsupported-integrations-title"><h3 id="unsupported-integrations-title" className="font-semibold text-slate-900">Not available in this installation</h3><p className="mt-1 text-sm text-slate-600">These providers are not connected to a working backend workflow and are intentionally not shown as integrations.</p><p className="mt-3 text-sm text-slate-700">{(data?.unsupported || []).join(" · ")}</p></section>
  </div>;
};

export default IntegrationsPage;