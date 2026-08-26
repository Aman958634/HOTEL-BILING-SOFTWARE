const EmptyState = ({ icon, title, description, action, className = "" }) => (
  <div className={`rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm ${className}`}>
    {icon ? <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center text-slate-400" aria-hidden="true">{icon}</div> : null}
    <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
    {description ? <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p> : null}
    {action ? <div className="mt-4">{action}</div> : null}
  </div>
);

export default EmptyState;
