import { FiCheckCircle, FiRefreshCw, FiWifiOff } from "react-icons/fi";
import { useConnectivity } from "../../context/ConnectivityContext";

const STATUS = {
  online: { label: "Online", className: "border-emerald-200 bg-emerald-50 text-emerald-800", Icon: FiCheckCircle },
  reconnecting: { label: "Reconnecting", className: "border-amber-200 bg-amber-50 text-amber-900", Icon: FiRefreshCw },
  offline: { label: "Offline", className: "border-rose-200 bg-rose-50 text-rose-800", Icon: FiWifiOff },
};

const ConnectivityIndicator = () => {
  const { state, lastOnlineAt, retry } = useConnectivity();
  const status = STATUS[state] || STATUS.reconnecting;
  const Icon = status.Icon;
  const staleLabel = state === "offline" ? "You're offline. Showing last available data." : null;
  const updatedLabel = lastOnlineAt ? `Last connected ${new Date(lastOnlineAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Checking server connection";

  return (
    <div className={`flex min-w-0 items-center gap-2 border-b px-3 py-1.5 text-xs font-semibold ${status.className}`} role="status" aria-live="polite">
      <Icon aria-hidden="true" className={state === "reconnecting" ? "animate-spin" : undefined} />
      <span>{status.label}</span>
      <span className="hidden min-w-0 truncate font-normal sm:inline">{staleLabel || updatedLabel}</span>
      {state !== "online" ? <button type="button" onClick={retry} className="ml-auto shrink-0 rounded px-2 py-1 font-semibold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current">Retry</button> : null}
    </div>
  );
};

export default ConnectivityIndicator;
