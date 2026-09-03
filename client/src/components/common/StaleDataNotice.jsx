import { FiClock } from "react-icons/fi";
import { useConnectivity } from "../../context/ConnectivityContext";

const StaleDataNotice = ({ savedAt }) => {
  const { state } = useConnectivity();
  if (state === "online" && !savedAt) return null;
  const label = savedAt ? `Last updated ${new Date(savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "No data loaded yet";
  return (
    <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800" role="status">
      <FiClock aria-hidden="true" />
      {state === "offline" ? "Offline data" : state === "reconnecting" ? "Reconnecting. Showing last available data." : label}
      {state !== "online" && savedAt ? <span className="font-normal text-amber-700">({label})</span> : null}
    </p>
  );
};

export default StaleDataNotice;
