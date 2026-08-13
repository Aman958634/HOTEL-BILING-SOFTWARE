import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { profileThunk } from "../../redux/slices/authSlice";

const ProfilePage = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(profileThunk());
  }, [dispatch]);

  if (!user) return <p>Loading profile...</p>;

  return (
    <div className="glass max-w-xl rounded-2xl p-6">
      <h2 className="text-2xl font-bold">Profile</h2>
      <p className="mt-3"><strong>Name:</strong> {user.fullName}</p>
      <p><strong>Email:</strong> {user.email}</p>
      <p><strong>Role:</strong> {user.role}</p>
    </div>
  );
};

export default ProfilePage;
