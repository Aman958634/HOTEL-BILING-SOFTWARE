import { FiMapPin } from "react-icons/fi";
import { useDispatch, useSelector } from "react-redux";
import { selectAuthorizedOutlet } from "../../redux/slices/authSlice";

const OutletSwitcher = () => {
  const dispatch = useDispatch();
  const { authorizedOutlets: outlets, activeOutletId, outletStatus } = useSelector((state) => state.auth);
  if (outletStatus !== "ready" || !outlets.length) return null;
  const changeOutlet = (event) => {
    const outletId = event.target.value;
    dispatch(selectAuthorizedOutlet(outletId));
    window.dispatchEvent(new CustomEvent("restosphere:outlet-changed", { detail: { outletId } }));
    window.location.reload();
  };
  return <label className="flex min-w-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 shadow-sm"><FiMapPin className="shrink-0 text-emerald-700" aria-hidden="true" /><span className="sr-only">Active outlet</span><select aria-label="Select active outlet" value={activeOutletId} onChange={changeOutlet} className="max-w-36 truncate bg-transparent text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-brand-600 sm:max-w-48">{outlets.map((outlet) => <option key={outlet._id} value={outlet._id}>{outlet.name}</option>)}</select></label>;
};
export default OutletSwitcher;
