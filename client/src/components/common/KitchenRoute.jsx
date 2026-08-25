import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux";

const KitchenRoute = ({ children }) => {
  const { accessToken, user, profileLoading } = useSelector((state) => state.auth);
  if (!accessToken) return <Navigate to="/login" replace />;
  if (profileLoading || !user) return <p className="p-6 text-center">Loading profile...</p>;
  const allowed = ["admin", "manager", "chef", "waiter", "cashier"];
  if (!allowed.includes(user.role)) return <Navigate to="/" replace />;
  return children;
};

export default KitchenRoute;
