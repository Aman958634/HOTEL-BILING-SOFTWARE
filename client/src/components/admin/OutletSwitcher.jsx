import { memo, useCallback, useState } from "react";
import { FiLoader, FiMapPin } from "react-icons/fi";
import { useDispatch, useSelector } from "react-redux";
import { selectAuthorizedOutlet } from "../../redux/slices/authSlice";

const OutletSwitcher = ({ className = "" }) => {
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
  return <label className={`flex min-h-11 min-w-0 max-w-full items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 shadow-sm ${switching ? "opacity-70" : ""} ${className}`}>
    {switching ? <FiLoader className="shrink-0 animate-spin text-emerald-700" aria-hidden="true" /> : <FiMapPin className="shrink-0 text-emerald-700" aria-hidden="true" />}
    <span className="sr-only">Current outlet</span>
    <select aria-label="Select current outlet" value={activeOutletId} onChange={changeOutlet} disabled={switching} className="min-w-0 max-w-36 flex-1 truncate bg-transparent text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand-600 disabled:cursor-wait sm:max-w-48" title={switching ? "Switching outlet" : "Current outlet"}>{outlets.map((outlet) => <option key={outlet._id} value={outlet._id}>{outlet.name}</option>)}</select>
    {switching ? <span className="sr-only" role="status">Switching outlet</span> : null}
  </label>;
};
export default memo(OutletSwitcher);
