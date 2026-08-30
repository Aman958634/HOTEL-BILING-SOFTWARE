import { Navigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";

const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const { accessToken, user, profileLoading, outletStatus } = useSelector((state) => state.auth);

  if (!accessToken || accessToken === "undefined" || accessToken === "null") {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (profileLoading || !user) {
    return <p className="p-6 text-center">Loading profile...</p>;
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
