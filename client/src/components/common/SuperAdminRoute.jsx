import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";

const SuperAdminRoute = ({ children }) => {
  const { accessToken, user, profileLoading } = useSelector((state) => state.auth);

  if (!accessToken || accessToken === "undefined" || accessToken === "null") {
    return <Navigate to="/super-admin-login" replace />;
  }

  if (profileLoading || !user) {
    return <p className="p-6 text-center">Loading profile...</p>;
  }

  if (!user.role || user.role !== "super_admin") {
    if (user.role === "admin") {
      return <Navigate to="/dashboard/admin" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return children;
};

export default SuperAdminRoute;
