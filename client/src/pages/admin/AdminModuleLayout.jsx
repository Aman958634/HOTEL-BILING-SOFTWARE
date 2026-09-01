import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import AdminSidebar from "../../components/admin/AdminSidebar";
import AdminHeader from "../../components/admin/AdminHeader";
import MobileAppHeader from "../../components/common/MobileAppHeader";
import { fetchMySubscription } from "../../services/billingService";
import {
  SubscriptionExpiredGate,
  TrialBanner,
} from "../../components/subscription/SubscriptionWidgets";

const RouteSkeleton = () => (
  <div className="space-y-4" aria-busy="true" aria-label="Loading page content">
    <div className="h-8 w-52 animate-pulse rounded-lg bg-slate-200" />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-100" />)}
    </div>
  </div>
);

const useDesktopLayout = () => {
  const [desktop, setDesktop] = useState(() => window.matchMedia("(min-width: 768px)").matches);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const sync = () => setDesktop(media.matches);
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
  return desktop;
};

const AdminModuleLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [blocked, setBlocked] = useState(null);
  const isDesktop = useDesktopLayout();
  const openSidebar = useCallback(() => setSidebarOpen(true), []);
  const location = useLocation();
  const isBilling =
    location.pathname.includes("/billing") ||
    location.pathname.includes("/my-subscription");
  const billingRef = useRef(isBilling);
  billingRef.current = isBilling;

  const loadSubscription = async () => {
    try {
      const { data } = await fetchMySubscription();
      const sub = data?.data || null;
      setSubscription(sub);
      if (sub?.status === "expired" || sub?.status === "cancelled" || sub?.status === "suspended") {
        if (!billingRef.current) {
          setBlocked({
            code: `SUBSCRIPTION_${String(sub.status).toUpperCase()}`,
            message:
              sub.status === "expired"
                ? "Please choose a paid plan to continue using RestoSphere."
                : data?.message,
          });
        }
      } else {
        setBlocked(null);
      }
    } catch (_err) {
      // billing endpoint should work even when expired; ignore soft failures here
    }
  };

  useEffect(() => {
    loadSubscription();
  }, []);

  useEffect(() => {
    const onBlocked = (event) => {
      if (isBilling) return;
      setBlocked(event.detail || { message: "Your 15-day free trial has ended." });
    };
    window.addEventListener("restosphere:subscription-blocked", onBlocked);
    return () => window.removeEventListener("restosphere:subscription-blocked", onBlocked);
  }, [isBilling]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }, [sidebarOpen]);

  return (
    <div className="h-screen overflow-hidden bg-slate-100">
      <div className="flex h-full">
        <AdminSidebar open={sidebarOpen} setOpen={setSidebarOpen} />

        <div className="min-w-0 flex-1 flex flex-col h-full md:ml-72">
          {isDesktop ? <AdminHeader /> : <MobileAppHeader onMenuClick={openSidebar} />}
          <main className="flex-1 overflow-y-auto overflow-x-hidden pb-0">
            <div className="p-4 md:p-6">
              {!isBilling && <TrialBanner subscription={subscription} />}
              <Suspense fallback={<RouteSkeleton />}>
                <Outlet />
              </Suspense>
            </div>
          </main>
        </div>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <SubscriptionExpiredGate
        open={Boolean(blocked) && !isBilling}
        message={blocked?.message}
        onClose={() => setBlocked(null)}
      />
    </div>
  );
};

export default AdminModuleLayout;
