import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { profileThunk } from "./redux/slices/authSlice";
import AppRouter from "./routes/AppRouter";

const App = () => {
  const dispatch = useDispatch();
  const { accessToken, user } = useSelector((state) => state.auth);
  const profileInFlightRef = useRef(false);

  useEffect(() => {
    if (accessToken && !user && !profileInFlightRef.current) {
      profileInFlightRef.current = true;
      dispatch(profileThunk()).finally(() => {
        profileInFlightRef.current = false;
      });
    }
  }, [accessToken, user, dispatch]);

  useEffect(() => {
    const showOutletAccessMessage = () => toast.error("Your outlet access changed. Resolving an authorized outlet…", { id: "outlet-access-denied" });
    window.addEventListener("restosphere:outlet-access-denied", showOutletAccessMessage);
    return () => window.removeEventListener("restosphere:outlet-access-denied", showOutletAccessMessage);
  }, []);

  return <AppRouter />;
};

export default App;
