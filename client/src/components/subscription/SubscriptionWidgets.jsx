import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FiCalendar, FiCreditCard, FiGift, FiLock, FiRefreshCw } from "react-icons/fi";
import { getServerClockOffset, getTrialCountdown } from "../../utils/trialCountdown";

const statusStyles = {
  trial: "bg-amber-100 text-amber-800 border-amber-200",
  active: "bg-emerald-100 text-emerald-800 border-emerald-200",
  expired: "bg-rose-100 text-rose-800 border-rose-200",
  cancelled: "bg-slate-200 text-slate-700 border-slate-300",
  suspended: "bg-orange-100 text-orange-800 border-orange-200",
};

const formatDateTime = (value) => value ? new Date(value).toLocaleString() : "—";
const isTrialActive = (subscription) => subscription?.entitlementState === "TRIAL_ACTIVE" || subscription?.status === "trial";
const isPaidExpired = (subscription) => subscription?.entitlementState === "SUBSCRIPTION_EXPIRED" ||
  (subscription?.status === "expired" && Boolean(subscription?.subscriptionEndAt || subscription?.renewalDate));
const pad = (value) => String(value).padStart(2, "0");

export const SubscriptionStatusBadge = ({ status }) => {
  const key = String(status || "").toLowerCase();
  return <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${statusStyles[key] || statusStyles.cancelled}`}>{key ? key.toUpperCase() : "UNKNOWN"}</span>;
};

/** The one-second timer is isolated here: it never re-renders dashboard data. */
export const TrialBanner = ({ subscription, onElapsed }) => {
  const endAt = subscription?.trialEndAt || subscription?.trialEndDate;
  const [remaining, setRemaining] = useState(() => getTrialCountdown(endAt, getServerClockOffset(subscription?.serverTime)));
  const elapsedRef = useRef(false);

  useEffect(() => {
    // The server supplies serverTime with the entitlement snapshot. Keep a
    // fixed offset for this render instead of trusting a manipulated device clock.
    const clockOffset = getServerClockOffset(subscription?.serverTime);
    elapsedRef.current = false;
    const tick = () => {
      const next = getTrialCountdown(endAt, clockOffset);
      setRemaining(next);
      if (next.remainingMs === 0 && !elapsedRef.current) {
        elapsedRef.current = true;
        onElapsed?.();
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [endAt, onElapsed, subscription?.serverTime]);

  if (!isTrialActive(subscription) || !endAt) return null;
  return (
    <section className="mb-5 overflow-hidden rounded-[28px] border border-orange-200 bg-[#fff9ef] px-4 py-5 text-slate-900 shadow-[0_14px_34px_rgba(177,101,23,0.08)] sm:px-6 sm:py-6 xl:px-7" aria-label="Free trial status">
      <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:gap-7">
        <div className="flex min-w-0 flex-1 items-start gap-4 sm:gap-5">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#ffedcf] text-2xl text-orange-500 sm:h-16 sm:w-16" aria-hidden="true"><FiGift /></span>
          <div className="min-w-0">
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl"><span className="text-orange-500">{subscription?.trialLabel || "Free Trial"}</span></h2>
            <p className="mt-1 text-sm font-medium text-slate-600 sm:text-[15px]">Explore all premium features. No payment required.</p>
            <div className="mt-4 flex flex-col gap-2 text-xs font-medium text-slate-600 sm:flex-row sm:items-center sm:gap-4 sm:text-sm">
              <span className="flex min-w-0 items-center gap-2"><FiCalendar className="shrink-0 text-emerald-600" aria-hidden="true" /><span className="truncate"><strong className="font-semibold text-slate-700">Trial Started:</strong> {formatDateTime(subscription.trialStartAt)}</span></span>
              <span className="hidden h-5 w-px bg-orange-200 sm:block" aria-hidden="true" />
              <span className="flex min-w-0 items-center gap-2"><FiCalendar className="shrink-0 text-orange-500" aria-hidden="true" /><span className="truncate"><strong className="font-semibold text-slate-700">Trial Ends:</strong> {formatDateTime(endAt)}</span></span>
            </div>
          </div>
        </div>
        <div className="border-t border-orange-200 pt-5 xl:border-l xl:border-t-0 xl:pl-7 xl:pt-0">
          <p className="mb-3 text-center text-sm font-bold text-slate-700 xl:text-left">Trial ends in</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3" aria-live="polite">
            {[[remaining.days, "Days"], [remaining.hours, "Hours"], [remaining.minutes, "Minutes"], [remaining.seconds, "Seconds"]].map(([value, label]) => <div key={label} className="flex min-h-[78px] min-w-0 flex-col items-center justify-center rounded-2xl bg-[#ffedd4] px-2 py-2 text-center sm:min-w-[74px]"><span className="text-xl font-extrabold tabular-nums text-orange-500 sm:text-2xl">{pad(value)}</span><span className="mt-1 text-[10px] font-semibold text-slate-500 sm:text-[11px]">{label}</span></div>)}
          </div>
        </div>
        <div className="flex shrink-0 flex-col gap-2 border-t border-orange-200 pt-5 sm:flex-row xl:border-l xl:border-t-0 xl:flex-col xl:pl-7 xl:pt-0">
          <Link to="/dashboard/admin/billing" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40">View Plans</Link>
          <Link to="/dashboard/admin/billing" className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-600 bg-white/70 px-5 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40">Upgrade Now</Link>
        </div>
      </div>
    </section>
  );
};

export const SubscriptionRequiredScreen = ({ subscription, onRefresh, refreshing = false }) => {
  const paidExpired = isPaidExpired(subscription);
  const planName = subscription?.planName || subscription?.currentPlanLabel || "your selected plan";
  const endedAt = paidExpired ? subscription?.subscriptionEndAt || subscription?.renewalDate : subscription?.trialEndAt || subscription?.trialEndDate;
  const title = paidExpired ? "Your subscription has expired" : "Your free trial has ended";
  const description = paidExpired
    ? "Your RestoSphere plan has ended. Renew your subscription to continue using restaurant operations."
    : "Your RestoSphere trial has ended. Choose a plan to continue managing your restaurant.";
  return (
    <section className="mx-auto flex min-h-[min(62vh,620px)] max-w-xl items-center py-6 sm:py-10" aria-labelledby="subscription-required-title">
      <div className="w-full rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-9">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-2xl text-teal-700"><FiCreditCard aria-hidden="true" /></span>
        <h1 id="subscription-required-title" className="mt-5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600 sm:text-base">{description}</p>
        <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-left text-sm text-slate-700">
          {paidExpired ? <><p><span className="font-semibold">Plan:</span> {planName}</p><p className="mt-1"><span className="font-semibold">Expired:</span> {formatDateTime(endedAt)}</p></> : <><p className="font-semibold text-rose-700">Trial ended</p><p className="mt-1">{formatDateTime(endedAt)}</p></>}
        </div>
        <p className="mt-4 text-sm text-slate-500">Your restaurant data is safe and preserved.</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/dashboard/admin/billing" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-teal-700 px-5 text-sm font-bold text-white hover:bg-teal-800">{paidExpired ? "Renew Plan" : "View Plans"}</Link>
          <button type="button" onClick={onRefresh} disabled={refreshing} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-teal-700 px-5 text-sm font-bold text-teal-800 hover:bg-teal-50 disabled:opacity-60"><FiRefreshCw className={refreshing ? "animate-spin" : ""} aria-hidden="true" />Refresh Access</button>
        </div>
        <p className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-500"><FiLock aria-hidden="true" /> Restaurant operations unlock automatically after server-verified payment.</p>
      </div>
    </section>
  );
};

export default SubscriptionStatusBadge;
