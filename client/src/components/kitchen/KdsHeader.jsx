import { FiCoffee, FiClock, FiLoader, FiCheckCircle, FiAlertTriangle, FiWifi, FiWifiOff, FiMaximize, FiMinimize, FiVolumeX, FiVolume2 } from "react-icons/fi";

const KdsHeader = ({
  restaurantName,
  now,
  connected,
  counts,
  thresholds,
  isFullscreen,
  soundMuted,
  onToggleFullscreen,
  onToggleSound,
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Kitchen Display</h1>
        <p className="mt-1 text-sm text-slate-500">
          {restaurantName || "Restaurant"} · {now.toLocaleDateString("en-IN", { weekday: "short", day: "2-digit", month: "short", year: "numeric" })} ·{" "}
          {now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
            <FiCoffee /> {counts.new || 0} New
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">
            <FiLoader /> {counts.preparing || 0} Prep
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            <FiCheckCircle /> {counts.ready || 0} Ready
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
            <FiClock /> {counts.completed || 0} Done
          </span>
          {(counts.delayed || 0) > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
              <FiAlertTriangle /> {counts.delayed || 0} Delayed
            </span>
          )}
        </div>

        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
          connected ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-slate-100 text-slate-600"
        }`}>
          {connected ? <FiWifi /> : <FiWifiOff />}
          {connected ? "Live" : "Offline"}
        </span>

        <button
          onClick={onToggleSound}
          className="rounded-xl border border-slate-300 bg-white p-2 text-slate-700 hover:bg-slate-50"
          aria-label={soundMuted ? "Unmute alerts" : "Mute alerts"}
        >
          {soundMuted ? <FiVolumeX /> : <FiVolume2 />}
        </button>

        <button
          onClick={onToggleFullscreen}
          className="rounded-xl border border-slate-300 bg-white p-2 text-slate-700 hover:bg-slate-50"
          aria-label={isFullscreen ? "Exit full screen" : "Full screen"}
        >
          {isFullscreen ? <FiMinimize /> : <FiMaximize />}
        </button>
      </div>
    </div>
  );
};

export default KdsHeader;
