const Card = ({ title, value, subtitle, children, className = "" }) => (
  <div className={`ui-card p-5 ${className}`}>
    <p className="text-sm text-slate-600">{title}</p>
    <h3 className="mt-1 text-2xl font-semibold">{value}</h3>
    {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
    {children}
  </div>
);

export default Card;
