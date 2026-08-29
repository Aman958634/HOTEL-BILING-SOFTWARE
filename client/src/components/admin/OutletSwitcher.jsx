import { useEffect, useState } from "react";
import { FiMapPin } from "react-icons/fi";
import { getMyOutlets } from "../../services/outletService";

const OutletSwitcher = () => {
  const [outlets, setOutlets] = useState([]);
  const [activeId, setActiveId] = useState(() => localStorage.getItem("activeOutletId") || "");
  useEffect(() => { let live = true; getMyOutlets().then(({ data }) => { if (!live) return; const rows = data?.data || []; setOutlets(rows); const allowed = rows.some((outlet) => outlet._id === activeId); const next = allowed ? activeId : (rows.find((outlet) => outlet.isDefault)?._id || rows[0]?._id || ""); if (next) { localStorage.setItem("activeOutletId", next); setActiveId(next); } }).catch(() => { if (live) setOutlets([]); }); return () => { live = false; }; }, []);
  if (!outlets.length) return null;
  return <label className="flex min-w-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700"><FiMapPin className="shrink-0 text-emerald-700" /><span className="sr-only">Active outlet</span><select value={activeId} onChange={(event) => { localStorage.setItem("activeOutletId", event.target.value); window.location.reload(); }} className="max-w-36 bg-transparent text-sm font-medium outline-none sm:max-w-48">{outlets.map((outlet) => <option key={outlet._id} value={outlet._id}>{outlet.name}</option>)}</select></label>;
};
export default OutletSwitcher;
