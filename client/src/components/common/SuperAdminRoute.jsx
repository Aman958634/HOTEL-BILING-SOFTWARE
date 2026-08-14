import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import { profileThunk } from "../../redux/slices/authSlice";

const roleRedirectMap = {
  admin: "/dashboard/admin",
  chef: "/dashboard/chef",
  waiter: "/dashboard/waiter",
  delivery: "/dashboard/delivery",
  customer: "/dashboard/customer",
  manager: "/dashboard/customer",
  cashier: "/dashboard/customer",
};

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
    return <Navigate to={roleRedirectMap[user.role] || "/login"} replace />;
  }

  return children;
};

export default SuperAdminRoute;
