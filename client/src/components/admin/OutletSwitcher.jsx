import { memo, useCallback, useState } from "react";
import { FiChevronDown, FiLoader, FiMapPin } from "react-icons/fi";
import { useDispatch, useSelector } from "react-redux";
import { selectAuthorizedOutlet } from "../../redux/slices/authSlice";

const locationFor = (outlet) => {
  const location = outlet?.location;
  if (typeof location === "string") return location;
  return [location?.city, location?.state || location?.region].filter(Boolean).join(", ") || outlet?.city || outlet?.address?.city || "";
};

const OutletSwitcher = ({ className = "", detailed = false }) => {
  const dispatch = useDispatch();
  const { authorizedOutlets: outlets, activeOutletId, outletStatus } = useSelector((state) => state.auth);
  const [switching, setSwitching] = useState(false);
  const changeOutlet = useCallback((event) => {
    const outletId = event.target.value;
    if (!outletId || outletId === activeOutletId || switching) return;
    setSwitching(true);
    dispatch(selectAuthorizedOutlet(outletId));
    window.dispatchEvent(new CustomEvent("restosphere:outlet-changed", { detail: { outletId } }));
    window.location.reload();
  }, [activeOutletId, dispatch, switching]);
  if (outletStatus !== "ready" || !outlets.length) return null;
  const activeOutlet = outlets.find((outlet) => outlet._id === activeOutletId) || outlets[0];
  const location = locationFor(activeOutlet);
  return <label className={`flex min-h-11 min-w-0 max-w-full items-center ${detailed ? "gap-2 rounded-xl border border-emerald-100 bg-emerald-50/60 px-2.5 shadow-sm transition hover:border-emerald-200" : "gap-1.5 rounded-xl border border-slate-200 bg-white px-2 shadow-sm"} py-1.5 text-sm text-slate-700 ${switching ? "opacity-70" : ""} ${className}`}>
    {switching ? <FiLoader className="shrink-0 animate-spin text-emerald-700" aria-hidden="true" /> : <FiMapPin className="shrink-0 text-emerald-700" aria-hidden="true" />}
    <span className="min-w-0 flex-1">
      {detailed ? <span className="block text-[11px] font-semibold uppercase tracking-wide text-emerald-800/70">Current outlet</span> : <span className="sr-only">Current outlet</span>}
      <select aria-label="Select current outlet" value={activeOutletId} onChange={changeOutlet} disabled={switching} className={`block min-w-0 bg-transparent text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:cursor-wait ${detailed ? "max-w-full text-slate-800" : "max-w-36 flex-1 sm:max-w-48"}`} title={switching ? "Switching outlet" : "Current outlet"}>{outlets.map((outlet) => <option key={outlet._id} value={outlet._id}>{outlet.name}</option>)}</select>
      {detailed && location ? <span className="block truncate text-xs text-slate-500">{location}</span> : null}
    </span>
    {detailed ? <FiChevronDown className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden="true" /> : null}
    {switching ? <span className="sr-only" role="status">Switching outlet</span> : null}
  </label>;
};
export default memo(OutletSwitcher);
