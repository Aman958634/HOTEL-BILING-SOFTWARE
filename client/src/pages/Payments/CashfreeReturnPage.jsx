import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getCashfreePaymentStatus } from "../../services/paymentService";

const CashfreeReturnPage = () => {
  const [params] = useSearchParams();
  const orderId = params.get("order_id") || "";
  const [state, setState] = useState({ loading: true, status: "", message: "Verifying your payment securely…" });

  const verify = useCallback(async () => {
    if (!orderId) {
      setState({ loading: false, status: "FAILED", message: "The payment reference is missing." });
      return;
    }
    setState({ loading: true, status: "", message: "Verifying your payment securely…" });
    try {
      const { data } = await getCashfreePaymentStatus(orderId);
      const status = data?.data?.status || "PENDING";
      const message = status === "PAID" ? "Payment verified. Your order is settled." : status === "FAILED" ? "The payment was not completed. Your order remains unpaid." : "Payment is still pending. Refresh this page in a moment.";
      setState({ loading: false, status, message });
    } catch (error) {
      setState({ loading: false, status: "", message: error?.response?.data?.message || "We could not verify this payment yet." });
    }
  }, [orderId]);

  useEffect(() => { void verify(); }, [verify]);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg items-center px-4 py-10">
      <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-700">Cashfree payment</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">{state.status === "PAID" ? "Payment received" : "Payment status"}</h1>
        <p className="mt-3 text-sm text-slate-600" aria-live="polite">{state.message}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          {state.status !== "PAID" && <button type="button" onClick={() => void verify()} disabled={state.loading} className="rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{state.loading ? "Verifying…" : "Verify again"}</button>}
          <Link to="/admin/orders" className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">Back to orders</Link>
        </div>
      </section>
    </main>
  );
};

export default CashfreeReturnPage;
