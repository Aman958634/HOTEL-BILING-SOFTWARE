import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import { profileThunk } from "../../redux/slices/authSlice";

const SuperAdminRoute = ({ children }) => {
  const dispatch = useDispatch();
  const { accessToken, user, profileLoading } = useSelector((state) => state.auth);

  useEffect(() => {
    if (accessToken && !user) {
      dispatch(profileThunk());
    }
  }, [accessToken, dispatch, user]);

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
