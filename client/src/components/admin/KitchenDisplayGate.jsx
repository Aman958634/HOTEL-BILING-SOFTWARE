import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { getRestaurantSettings } from "../../services/restaurantService";

// The sidebar is only a convenience. This route gate keeps a disabled KDS
// out of the browser as well; the server independently enforces the same
// restaurant setting for every KDS API request.
const KitchenDisplayGate = ({ children }) => {
  const [enabled, setEnabled] = useState(null);

  useEffect(() => {
    let active = true;
    getRestaurantSettings()
      .then(({ data }) => {
        if (active) setEnabled(data?.data?.kitchenDisplayEnabled !== false);
      })
      // Preserve the server authorization boundary if settings cannot load.
      .catch(() => { if (active) setEnabled(true); });
    return () => { active = false; };
  }, []);

  if (enabled === null) return <div className="min-h-40" aria-busy="true" />;
  return enabled ? children : <Navigate to="/dashboard/admin/orders" replace />;
};

export default KitchenDisplayGate;
