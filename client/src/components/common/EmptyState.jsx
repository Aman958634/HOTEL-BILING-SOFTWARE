import ModuleIcon from "./ModuleIcon";

const EmptyState = ({ icon, iconModule = "default", title, description, action, className = "" }) => (
  <section className={`rounded-xl border border-dashed border-slate-300 bg-gradient-to-b from-white to-slate-50/70 p-4 text-center shadow-sm sm:rounded-2xl sm:p-6 ${className}`}>
    {icon ? <ModuleIcon icon={icon} module={iconModule} variant="empty" className="mx-auto mb-3" /> : null}
    <h3 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h3>
    {description ? <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{description}</p> : null}
    {action ? <div className="mt-4">{action}</div> : null}
  </section>
);

export default EmptyState;
