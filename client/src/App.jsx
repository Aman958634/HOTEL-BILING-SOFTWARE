import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { profileThunk } from "./redux/slices/authSlice";
import AppRouter from "./routes/AppRouter";

const App = () => {
  const dispatch = useDispatch();
  const { accessToken, user } = useSelector((state) => state.auth);

  useEffect(() => {
    if (accessToken && !user) {
      dispatch(profileThunk());
    }
  }, [accessToken, user, dispatch]);

  return <AppRouter />;
};

export default App;
