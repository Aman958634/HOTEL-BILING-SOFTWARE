import { Navigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";

const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const { accessToken } = useSelector((state) => state.auth);

  if (!accessToken || accessToken === "undefined" || accessToken === "null") {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
