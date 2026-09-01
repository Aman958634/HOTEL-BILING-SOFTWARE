import { FiAlertCircle, FiRefreshCw } from "react-icons/fi";

const RequestState = ({ title = "Unable to load this section", message = "Please check your connection and try again.", onRetry }) => (
  <section className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center sm:p-8" role="alert">
    <FiAlertCircle className="mx-auto mb-3 h-10 w-10 text-rose-500" aria-hidden="true" />
    <h3 className="text-lg font-semibold text-rose-900">{title}</h3>
    <p className="mt-2 text-sm text-rose-700">{message}</p>
    {onRetry ? (
      <button type="button" onClick={onRetry} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-800">
        <FiRefreshCw aria-hidden="true" /> Retry
      </button>
    ) : null}
  </section>
);

export default RequestState;
