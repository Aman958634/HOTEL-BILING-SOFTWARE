import { forwardRef, useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";

const PasswordInput = forwardRef(function PasswordInput(
  { className = "", containerClassName = "", ...inputProps },
  ref
) {
  const [visible, setVisible] = useState(false);

  const inputClassName = [className, "pr-10"].filter(Boolean).join(" ").trim();

  return (
    <div className={`relative w-full ${containerClassName}`.trim()}>
      <input
        ref={ref}
        type={visible ? "text" : "password"}
        className={inputClassName}
        {...inputProps}
      />
      <button
        type="button"
        tabIndex={0}
        onClick={() => setVisible((current) => !current)}
        className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 transition-colors hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700/30"
        aria-label={visible ? "Hide password" : "Show password"}
      >
        {visible ? <FiEyeOff className="h-[18px] w-[18px]" aria-hidden="true" /> : <FiEye className="h-[18px] w-[18px]" aria-hidden="true" />}
      </button>
    </div>
  );
});

export default PasswordInput;
