const variants = {
  primary: "bg-brand-700 text-white shadow-sm shadow-brand-900/10 hover:bg-brand-800",
  secondary: "border border-slate-200 bg-white text-slate-700 shadow-sm hover:bg-slate-50",
  outline: "border border-brand-700 bg-white text-brand-800 hover:bg-brand-50",
  ghost: "bg-transparent text-slate-700 hover:bg-slate-100",
  danger: "bg-rose-600 text-white shadow-sm shadow-rose-900/10 hover:bg-rose-700",
};

const Button = ({ children, className = "", variant = "primary", type = "button", loading = false, loadingText, ...props }) => (
  <button
    type={type}
    disabled={loading || props.disabled}
    aria-busy={loading || undefined}
    className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 ${variants[variant] || variants.primary} ${className}`}
    {...props}
  >
    {loading ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" /> : null}
    {loading && loadingText ? loadingText : children}
  </button>
);

export default Button;
