import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import { profileThunk } from "../../redux/slices/authSlice";

const roleRedirectMap = {
  chef: "/dashboard/chef",
  waiter: "/dashboard/waiter",
  delivery: "/dashboard/delivery",
  customer: "/dashboard/customer",
  manager: "/dashboard/customer",
  cashier: "/dashboard/customer",
};

const AdminRoute = ({ children }) => {
  const dispatch = useDispatch();
  const { accessToken, user, profileLoading } = useSelector((state) => state.auth);

  useEffect(() => {
    if (accessToken && !user) {
      dispatch(profileThunk());
    }
  }, [accessToken, dispatch, user]);

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  if (profileLoading || !user) {
    return <p className="p-6 text-center">Loading profile...</p>;
  }

  if (user.role !== "admin") {
    return <Navigate to={roleRedirectMap[user.role] || "/dashboard/customer"} replace />;
  }

  return children;
};

export default AdminRoute;
