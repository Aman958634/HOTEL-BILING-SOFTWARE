const Card = ({ title, value, subtitle }) => (
  <div className="glass rounded-2xl p-4">
    <p className="text-sm text-slate-600">{title}</p>
    <h3 className="mt-1 text-2xl font-semibold">{value}</h3>
    {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
  </div>
);

export default Card;
