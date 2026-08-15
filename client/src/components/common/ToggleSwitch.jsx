const ToggleSwitch = ({ checked, onChange, label, id }) => {
  const switchId = id || label?.replace(/\s+/g, "-").toLowerCase();

  return (
    <label htmlFor={switchId} className="flex cursor-pointer items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <span className="text-sm font-medium text-slate-800">{label}</span>
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30 ${
          checked ? "bg-brand-700" : "bg-slate-300"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
        <span className="sr-only">{label}</span>
      </button>
    </label>
  );
};

export default ToggleSwitch;
