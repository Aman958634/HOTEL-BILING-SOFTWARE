import { memo } from "react";
import { useLocation } from "react-router-dom";
import { FiAward, FiMenu } from "react-icons/fi";
import NotificationBell from "./NotificationBell";
import GlobalSearch from "../common/GlobalSearch";
import OutletSwitcher from "./OutletSwitcher";
import ProfileMenu from "../common/ProfileMenu";
import TodayControl from "../common/TodayControl";

const pageMeta = [
  ["/online-orders", "Online Orders", "Track and fulfill orders from every sales channel."],
  ["/central-kitchen", "Central Kitchen", "Coordinate requisitions, production, and transfers."],
  ["/business-intelligence", "Business Intelligence", "Understand performance with clear operational metrics."],
  ["/my-subscription", "My Subscription", "Review your plan and billing information."],
  ["/intelligence", "RestoSphere Intelligence", "Review restaurant insights and actionable alerts."],
  ["/notifications", "Notifications", "Stay on top of important restaurant activity."],
  ["/customers", "Customer CRM", "Build lasting relationships with your customers."],
  ["/inventory", "Inventory", "Keep stock levels and availability under control."],
  ["/settings", "Settings", "Manage your restaurant preferences and access."],
  ["/payments", "Payments", "Review payments, refunds, and reconciliation."],
  ["/reports", "Reports", "View your restaurant’s operational performance."],
  ["/billing", "Billing & Plans", "Manage billing and your RestoSphere plan."],
  ["/outlets", "Outlets", "Manage your authorized restaurant outlets."],
  ["/orders", "Orders", "Manage restaurant orders and their service status."],
  ["/tables", "Tables", "See table availability and active service."],
  ["/staff", "Staff", "Manage team members and service assignments."],
  ["/kitchen", "Kitchen Display", "Keep kitchen tickets moving in real time."],
  ["/menu", "Menu Management", "Maintain your menu, prices, and availability."],
  ["/categories", "Categories", "Organize your menu for faster service."],
  ["/cockpit", "Service Cockpit", "Monitor live service and urgent activity."],
  ["/loyalty", "Loyalty & Rewards", "Manage customer rewards and activity."],
];

const AdminHeader = ({ title, subtitle, onMenuClick, sidebarOpen = true, sidebarId, profilePath = "/profile", settingsPath = "/dashboard/admin/settings" }) => {
  const { pathname } = useLocation();
  const matchedMeta = pageMeta.find(([path]) => pathname.includes(path));
  const resolvedTitle = title || matchedMeta?.[1] || "Dashboard";
  const resolvedSubtitle = subtitle || matchedMeta?.[2] || "Today’s restaurant performance at a glance.";
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur-md xl:px-6">
      <div className="mx-auto max-w-screen-2xl">
        <div className="flex min-w-0 items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={onMenuClick} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 transition hover:bg-emerald-100 focus-visible:ring-2 focus-visible:ring-emerald-600" aria-label={sidebarOpen ? "Hide navigation menu" : "Open navigation menu"} aria-expanded={sidebarOpen} aria-controls={sidebarId}>
              <FiMenu className="h-5 w-5" />
            </button>
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-600/20"><FiAward className="h-5 w-5" /></span>
              <div className="min-w-0">
                <p className="truncate text-lg font-bold tracking-tight text-slate-900">RestoSphere</p>
                <p className="hidden truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700 2xl:block">Smart restaurant management</p>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden min-w-0 text-right 2xl:block">
              <p className="text-sm font-semibold text-slate-800">{resolvedTitle}</p>
              <p className="max-w-64 truncate text-xs text-slate-500">{resolvedSubtitle}</p>
            </div>
            <NotificationBell />
            <ProfileMenu profilePath={profilePath} settingsPath={settingsPath} />
          </div>
        </div>

        <div className="mt-3 min-w-0">
          <GlobalSearch showShortcut className="w-full min-w-0" />
        </div>

        <div className="mt-3 flex min-w-0 flex-wrap gap-2.5">
          <OutletSwitcher detailed className="min-w-[15rem] flex-[1_1_18rem]" />
          <TodayControl detailed className="min-w-[10rem] flex-[0_1_14rem]" />
        </div>
      </div>
    </header>
  );
};

export default memo(AdminHeader);
