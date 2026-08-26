import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
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

  return <AppRouter />;
};

export default App;
