import { Navigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";

const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const { accessToken, user, profileLoading } = useSelector((state) => state.auth);

  if (!accessToken || accessToken === "undefined" || accessToken === "null") {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (profileLoading || !user) {
    return <p className="p-6 text-center">Loading profile...</p>;
  }

  return children;
};

export default ProtectedRoute;
