import { Navigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { profileThunk } from "../../redux/slices/authSlice";

const ProfileSkeleton = () => <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6" aria-busy="true" aria-label="Loading account">
  <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="h-14 w-14 animate-pulse rounded-2xl bg-slate-200" /><div className="min-w-0 flex-1 space-y-2"><div className="h-4 w-40 animate-pulse rounded bg-slate-200" /><div className="h-3 w-56 max-w-full animate-pulse rounded bg-slate-100" /></div></div>
  <div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: 2 }).map((_, index) => <div key={index} className="h-44 animate-pulse rounded-2xl border border-slate-200 bg-white" />)}</div>
</div>;

const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const dispatch = useDispatch();
  const { accessToken, user, profileLoading, profileError, outletStatus } = useSelector((state) => state.auth);

  if (!accessToken || accessToken === "undefined" || accessToken === "null") {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (profileLoading || (!user && !profileError)) {
    return <ProfileSkeleton />;
  }

  if (!user && profileError) {
    return <div className="mx-auto mt-10 max-w-md rounded-2xl border border-rose-200 bg-white p-6 text-center shadow-sm"><h1 className="text-lg font-bold text-slate-900">Unable to load profile</h1><p className="mt-2 text-sm leading-6 text-slate-600">We couldn't load your profile details.</p><button type="button" onClick={() => dispatch(profileThunk())} className="mt-4 min-h-11 rounded-xl bg-brand-700 px-4 text-sm font-semibold text-white hover:bg-brand-800">Retry</button></div>;
  }

  const requiresOutlet = Boolean(user.restaurant) && !["customer", "super_admin"].includes(String(user.role || "").toLowerCase());
  if (requiresOutlet && outletStatus === "loading") {
    return <p className="p-6 text-center">Preparing your authorized outlet...</p>;
  }

  if (requiresOutlet && outletStatus === "no-access") {
    return <div className="mx-auto mt-16 max-w-md rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-900"><h1 className="text-lg font-bold">No outlet access</h1><p className="mt-2">Your account has no active outlet assigned. Ask a restaurant administrator to assign an outlet before using operational dashboards.</p></div>;
  }

  return children;
};

export default ProtectedRoute;
