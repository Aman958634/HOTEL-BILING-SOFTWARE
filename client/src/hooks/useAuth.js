import { useSelector } from "react-redux";

const useAuth = () => {
  const auth = useSelector((state) => state.auth);
  return {
    isAuthenticated: Boolean(auth.user),
    user: auth.user,
    loading: auth.loading,
    profileLoading: auth.profileLoading,
    accessToken: auth.accessToken,
  };
};

export default useAuth;
