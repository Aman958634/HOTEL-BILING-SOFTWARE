const BrandMark = ({ compact = false, dark = false, className = "" }) => (
  <div className={`flex items-center gap-2.5 ${className}`}>
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-700 text-xl font-bold text-white shadow-sm shadow-brand-700/25" aria-hidden="true">R</span>
    {!compact ? <span className={`text-xl font-bold tracking-tight ${dark ? "text-white" : "text-slate-900"}`}>RestoSphere</span> : null}
  </div>
);

export default BrandMark;
