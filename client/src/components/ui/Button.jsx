const Button = ({ children, className = "", ...props }) => (
  <button
    className={`rounded-xl px-4 py-2 font-medium transition hover:opacity-90 bg-brand-700 text-white ${className}`}
    {...props}
  >
    {children}
  </button>
);

export default Button;
