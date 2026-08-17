import { Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { profileThunk } from "../../redux/slices/authSlice";

const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const dispatch = useDispatch();
  const { accessToken, user, profileLoading } = useSelector((state) => state.auth);

  useEffect(() => {
    if (accessToken && !user) {
      dispatch(profileThunk());
    }
  }, [accessToken, user, dispatch]);

  if (!accessToken || accessToken === "undefined" || accessToken === "null") {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (profileLoading || !user) {
    return <p className="p-6 text-center">Loading profile...</p>;
  }

  return children;
};

export default ProtectedRoute;
