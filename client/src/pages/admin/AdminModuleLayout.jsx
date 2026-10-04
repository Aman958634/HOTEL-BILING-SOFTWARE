import { Suspense, useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Outlet, useLocation } from "react-router-dom";
import AdminSidebar from "../../components/admin/AdminSidebar";
import AdminHeader from "../../components/admin/AdminHeader";
import MobileAppHeader from "../../components/common/MobileAppHeader";
import { fetchMySubscription } from "../../services/billingService";
import { TrialBanner, SubscriptionRequiredScreen } from "../../components/subscription/SubscriptionWidgets";

const RouteSkeleton = () => <div className="space-y-4" aria-busy="true" aria-label="Loading subscription access"><div className="h-8 w-52 animate-pulse rounded-lg bg-slate-200" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-100" />)}</div></div>;
const useDesktopLayout = () => {
  const [desktop, setDesktop] = useState(() => window.matchMedia("(min-width: 1024px)").matches);
  useEffect(() => { const media = window.matchMedia("(min-width: 1024px)"); const sync = () => setDesktop(media.matches); media.addEventListener("change", sync); return () => media.removeEventListener("change", sync); }, []);
  return desktop;
};
const canOperate = (subscription) => ["TRIAL_ACTIVE", "SUBSCRIPTION_ACTIVE"].includes(subscription?.entitlementState) || ["trial", "active"].includes(subscription?.status);
const isSubscriptionRoute = (pathname) => pathname.includes("/billing") || pathname.includes("/my-subscription");

const SubscriptionHeader = () => <div className="flex min-h-16 shrink-0 items-center border-b border-slate-200 bg-white px-5 text-sm font-bold text-slate-800 lg:px-8">Resto<span className="text-teal-700">Sphere</span><span className="ml-3 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">Subscription required</span></div>;

const AdminModuleLayout = () => {
  const user = useSelector((state) => state.auth.user);
  const activeOutletId = useSelector((state) => state.auth.activeOutletId);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [loadingSubscription, setLoadingSubscription] = useState(true);
  const isDesktop = useDesktopLayout();
  const location = useLocation();
  const billingRoute = isSubscriptionRoute(location.pathname);
  const loadSubscription = useCallback(async () => {
    setLoadingSubscription(true);
    try {
      const { data } = await fetchMySubscription();
      setSubscription(data?.data || null);
    } catch {
      // Fail closed for operational pages: an unknown entitlement never mounts operations.
    } finally {
      setLoadingSubscription(false);
    }
  }, []);
  const operationalAccess = canOperate(subscription);
  const locked = !loadingSubscription && !operationalAccess;

  useEffect(() => { loadSubscription(); }, [loadSubscription]);
  useEffect(() => {
    const refresh = () => loadSubscription();
    window.addEventListener("restosphere:subscription-updated", refresh);
    window.addEventListener("restosphere:subscription-blocked", refresh);
    return () => { window.removeEventListener("restosphere:subscription-updated", refresh); window.removeEventListener("restosphere:subscription-blocked", refresh); };
  }, [loadSubscription]);
  useEffect(() => { if (!sidebarOpen) return undefined; const onKey = (event) => { if (event.key === "Escape") setSidebarOpen(false); }; document.addEventListener("keydown", onKey); return () => document.removeEventListener("keydown", onKey); }, [sidebarOpen]);
  useEffect(() => { if (!sidebarOpen) return undefined; const previousOverflow = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = previousOverflow; }; }, [sidebarOpen]);
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  const permissionByPath = [["/dashboard/admin", "reports.view_full"], ["/orders", "orders.view"], ["/kitchen", "kds.view"], ["/inventory", "inventory.view"], ["/staff", "staff.view"], ["/payments", "payments.view"], ["/reports", "reports.view_basic"], ["/business-intelligence", "reports.view_full"], ["/intelligence", "reports.view_full"]];
  const requiredPermission = permissionByPath.find(([path]) => location.pathname.endsWith(path))?.[1];
  const adminOnlyPaths = ["/menu", "/categories", "/procurement", "/central-kitchen", "/billing", "/my-subscription", "/notifications", "/outlets", "/integrations"];
  const adminOnly = adminOnlyPaths.some((path) => location.pathname.endsWith(path));
  const canManageHotelSettings = ["admin", "hotel_admin", "restaurant_admin", "super_admin"].includes(String(user?.role || "").toLowerCase());
  const denied = user?.role !== "admin" && (adminOnly || (location.pathname.endsWith("/settings") && !canManageHotelSettings) || (requiredPermission && !user?.permissions?.includes(requiredPermission)));
  const showOperationalOutlet = !loadingSubscription && operationalAccess;
  const showBillingOutlet = !loadingSubscription && billingRoute;
  const showRequired = !loadingSubscription && !operationalAccess && !billingRoute;

  return <div className="app-shell dashboard-shell"><div className="flex h-dvh overflow-hidden">
    <AdminSidebar open={sidebarOpen} setOpen={setSidebarOpen} subscriptionLocked={locked} />
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden lg:ml-72">
      {showOperationalOutlet ? (isDesktop ? <AdminHeader /> : <MobileAppHeader premium onMenuClick={() => setSidebarOpen(true)} sidebarOpen={sidebarOpen} sidebarId="admin-navigation-drawer" />) : <SubscriptionHeader />}
      <main className="admin-module-main min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain"><div className="admin-module-content app-page-container">
        {loadingSubscription ? <RouteSkeleton /> : null}
        {showOperationalOutlet ? <>{!billingRoute && <TrialBanner subscription={subscription} onElapsed={loadSubscription} />}{denied ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800" role="alert"><h1 className="text-lg font-semibold">Access Denied</h1><p className="mt-1 text-sm">Your role does not allow this module.</p></div> : <Suspense fallback={<RouteSkeleton />}><Outlet key={activeOutletId || "no-outlet"} /></Suspense>}</> : null}
        {showBillingOutlet ? <Suspense fallback={<RouteSkeleton />}><Outlet key={activeOutletId || "no-outlet"} /></Suspense> : null}
        {showRequired ? <SubscriptionRequiredScreen subscription={subscription} onRefresh={loadSubscription} refreshing={loadingSubscription} /> : null}
      </div></main>
    </div></div>
    {sidebarOpen && <div className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}
  </div>;
};

export default AdminModuleLayout;
