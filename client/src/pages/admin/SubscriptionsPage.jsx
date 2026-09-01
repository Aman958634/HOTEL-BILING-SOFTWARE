import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  activateSubscription,
  cancelSubscription,
  extendSubscriptionTrial,
  fetchPlans,
  fetchSubscriptions,
  suspendSubscription,
} from "../../services/superAdminService";
import { SubscriptionStatusBadge } from "../../components/subscription/SubscriptionWidgets";
import SelectPlanModal from "../../components/subscription/SelectPlanModal";

const formatDateTime = (value) => (value ? new Date(value).toLocaleString() : "—");

const ConfirmModal = ({ open, title, message, confirmLabel, onConfirm, onCancel, busy }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
          >
            {busy ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

const daysCell = (s) => {
  if (s.status === "trial") {
    if (s.daysRemaining <= 0 || s.daysRemainingLabel === "EXPIRED") return "EXPIRED";
    return s.daysRemainingLabel || `${s.daysRemaining} days remaining`;
  }
  if (s.status === "expired") return "EXPIRED";
  return "—";
};

const SubscriptionsPage = () => {
  const [subs, setSubs] = useState([]);
  const [plans, setPlans] = useState([]);
  const [busyId, setBusyId] = useState("");
  const [modal, setModal] = useState(null);
  const [planModalSub, setPlanModalSub] = useState(null);

  const load = async () => {
    try {
      const [subsRes, plansRes] = await Promise.all([fetchSubscriptions(), fetchPlans()]);
      setSubs(subsRes.data?.data || []);
      setPlans(plansRes.data?.data || []);
    } catch (_err) {
      toast.error("Failed to load subscriptions");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const runAction = async (id, actionFn, successMessage) => {
    setBusyId(id);
    try {
      await actionFn();
      toast.success(successMessage);
      setModal(null);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Action failed");
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Subscriptions</h2>
        <p className="mt-1 text-sm text-slate-500">
          Every new hotel receives a <strong>15-Day Free Trial</strong>. Select a paid plan, then complete payment separately.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="sa-card-table sa-subscriptions-table min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">Hotel / Restaurant</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Trial Start</th>
              <th className="px-4 py-3">Trial End</th>
              <th className="px-4 py-3">Days Remaining</th>
              <th className="px-4 py-3">Renewal Date</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {subs.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-slate-500">
                  No subscriptions found.
                </td>
              </tr>
            )}
            {subs.map((s) => (
              <tr key={s._id} className="border-t border-slate-100 align-top">
                <td className="px-4 py-3 font-medium text-slate-900">{s.restaurant?.name || "—"}</td>
                <td className="px-4 py-3 capitalize">
                  {s.status === "trial" ? (
                    <span>
                      {s.planName || "basic"} · <span className="text-amber-700">15-Day Free Trial</span>
                    </span>
                  ) : s.status === "active" ? (
                    <div>
                      <p className="font-medium capitalize">{s.planName || "—"}</p>
                      <p className="text-xs text-slate-500">₹{s.price}/month</p>
                      {s.subscriptionStartAt && (
                        <p className="text-xs text-slate-500">
                          Started: {new Date(s.subscriptionStartAt).toLocaleDateString("en-IN")}
                        </p>
                      )}
                    </div>
                  ) : (
                    <>
                      {s.metadata?.selectedPaidPlan || s.planName || "—"}
                    </>
                  )}
                </td>
                <td className="px-4 py-3">
                  <SubscriptionStatusBadge status={s.status} />
                </td>
                <td className="px-4 py-3">{formatDateTime(s.trialStartAt || s.trialStartDate)}</td>
                <td className="px-4 py-3">{formatDateTime(s.trialEndAt || s.trialEndDate)}</td>
                <td className="px-4 py-3 font-medium">{daysCell(s)}</td>
                <td className="px-4 py-3">{s.status === "active" ? formatDateTime(s.renewalDate) : "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex min-w-[240px] flex-wrap gap-2">
                    {s.status === "expired" && (
                      <span className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-800">
                        Upgrade Subscription
                      </span>
                    )}
                    {(s.status === "trial" || s.status === "expired") && (
                      <button
                        type="button"
                        disabled={busyId === s._id}
                        onClick={() =>
                          setModal({
                            type: "extend",
                            sub: s,
                            title: "Extend trial",
                            message: `Extend the 15-day free trial for ${s.restaurant?.name}? Enter days in the next step.`,
                          })
                        }
                        className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                      >
                        Extend trial
                      </button>
                    )}
                    {["trial", "expired", "cancelled"].includes(s.status) && (
                      <button
                        type="button"
                        disabled={busyId === s._id}
                        onClick={() => setPlanModalSub(s)}
                        className="rounded border border-teal-300 bg-teal-50 px-2 py-1 text-xs font-medium text-teal-900 hover:bg-teal-100"
                      >
                        {s.status === "expired" ? "Upgrade Subscription" : "Select Paid Plan"}
                      </button>
                    )}
                    {s.status !== "active" && (
                      <button
                        type="button"
                        disabled={busyId === s._id}
                        onClick={() =>
                          setModal({
                            type: "activate",
                            sub: s,
                            title: "Activate Manually (Admin)",
                            message: `Manually activate ${s.restaurant?.name} without payment? This bypasses payment and is for administrative use only.`,
                          })
                        }
                        className="rounded border border-emerald-300 px-2 py-1 text-xs text-emerald-800 hover:bg-emerald-50"
                      >
                        Activate Manually (Admin)
                      </button>
                    )}
                    {["trial", "active"].includes(s.status) && (
                      <button
                        type="button"
                        disabled={busyId === s._id}
                        onClick={() =>
                          setModal({
                            type: "suspend",
                            sub: s,
                            title: "Suspend subscription",
                            message: `Suspend access for ${s.restaurant?.name}?`,
                          })
                        }
                        className="rounded border border-orange-300 px-2 py-1 text-xs text-orange-800 hover:bg-orange-50"
                      >
                        Suspend
                      </button>
                    )}
                    {s.status !== "cancelled" && (
                      <button
                        type="button"
                        disabled={busyId === s._id}
                        onClick={() =>
                          setModal({
                            type: "cancel",
                            sub: s,
                            title: "Cancel subscription",
                            message: `Cancel subscription for ${s.restaurant?.name}?`,
                          })
                        }
                        className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-800 hover:bg-rose-50"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SelectPlanModal
        open={Boolean(planModalSub)}
        subscription={planModalSub}
        plans={plans}
        onClose={() => setPlanModalSub(null)}
        onComplete={load}
      />

      <ConfirmModal
        open={Boolean(modal) && modal?.type !== "convert"}
        title={modal?.title}
        message={modal?.message}
        confirmLabel="Confirm"
        busy={Boolean(busyId)}
        onCancel={() => setModal(null)}
        onConfirm={async () => {
          if (!modal?.sub) return;
          const sub = modal.sub;

          if (modal.type === "extend") {
            const daysRaw = window.prompt("Extend trial by how many days?", "7");
            if (daysRaw == null) return;
            const days = Number(daysRaw);
            if (!Number.isFinite(days) || days <= 0) {
              toast.error("Enter a valid number of days");
              return;
            }
            await runAction(sub._id, () => extendSubscriptionTrial(sub._id, days), "Trial extended");
            return;
          }

          if (modal.type === "activate") {
            const planName = window.prompt(
              "Activate manually with plan (basic / professional / enterprise)",
              sub.metadata?.selectedPaidPlan || sub.planName || "basic"
            );
            if (!planName) return;
            await runAction(sub._id, () => activateSubscription(sub._id, planName), "Subscription activated manually (admin)");
            return;
          }

          if (modal.type === "suspend") {
            await runAction(sub._id, () => suspendSubscription(sub._id), "Subscription suspended");
            return;
          }

          if (modal.type === "cancel") {
            await runAction(sub._id, () => cancelSubscription(sub._id), "Subscription cancelled");
          }
        }}
      />
    </div>
  );
};

export default SubscriptionsPage;
