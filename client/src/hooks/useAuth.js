import { useSelector } from "react-redux";

const useAuth = () => {
  const auth = useSelector((state) => state.auth);
  return {
    isAuthenticated: Boolean(auth.accessToken),
    user: auth.user,
    loading: auth.loading,
  };
};

export default useAuth;
