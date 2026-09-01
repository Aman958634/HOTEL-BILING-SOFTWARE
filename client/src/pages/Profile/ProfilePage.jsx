import { useState } from "react";
import { FiBriefcase, FiCalendar, FiMail, FiMapPin, FiPhone, FiShield, FiUser } from "react-icons/fi";
import { useSelector } from "react-redux";

const present = (value) => value || "Not provided";
const nameFrom = (value) => (value && typeof value === "object" ? value.name || value.outletName || value.title || "Not provided" : "Not provided");
const label = (value) => String(value || "User").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const formatDate = (value) => {
  if (!value) return "Not provided";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not provided" : date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
};

const InfoRow = ({ icon, label: rowLabel, value }) => <div className="min-w-0 rounded-xl bg-slate-50 p-3"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{icon}{rowLabel}</div><p className="mt-1 break-words text-sm font-medium text-slate-900">{present(value)}</p></div>;

const ProfilePage = () => {
  const { user, authorizedOutlets, activeOutletId } = useSelector((state) => state.auth);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const fullName = user?.fullName || user?.name || "Account";
  const avatar = user?.avatar || user?.profilePhoto;
  const activeOutlet = (authorizedOutlets || []).find((outlet) => String(outlet?._id) === String(activeOutletId));
  const initials = fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "A";

  return <div className="mx-auto max-w-4xl space-y-4 pb-12 sm:space-y-5">
    <section className="ui-card overflow-hidden p-4 sm:p-6">
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        {avatar && !avatarFailed ? <img src={avatar} alt={`${fullName} profile`} onError={() => setAvatarFailed(true)} className="h-20 w-20 rounded-2xl object-cover" /> : <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-700 text-xl font-bold text-white" aria-label={`${fullName} initials`}>{initials}</div>}
        <div className="min-w-0 flex-1"><p className="text-sm font-medium text-brand-700">Your account</p><h1 className="mt-1 break-words text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{fullName}</h1><p className="mt-1 break-words text-sm text-slate-600">{present(user?.email)}</p><span className="mt-3 inline-flex rounded-full border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">{label(user?.role)}</span></div>
      </div>
    </section>

    <div className="grid gap-4 lg:grid-cols-2">
      <section className="ui-card p-4 sm:p-5"><h2 className="text-lg font-bold text-slate-900">Personal information</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><InfoRow icon={<FiUser aria-hidden="true" />} label="Full name" value={fullName} /><InfoRow icon={<FiMail aria-hidden="true" />} label="Email" value={user?.email} /><InfoRow icon={<FiPhone aria-hidden="true" />} label="Phone" value={user?.phone} /><InfoRow icon={<FiBriefcase aria-hidden="true" />} label="Role" value={label(user?.role)} /></div></section>
      <section className="ui-card p-4 sm:p-5"><h2 className="text-lg font-bold text-slate-900">Account information</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><InfoRow icon={<FiMapPin aria-hidden="true" />} label="Restaurant" value={nameFrom(user?.restaurant)} /><InfoRow icon={<FiMapPin aria-hidden="true" />} label="Active outlet" value={nameFrom(activeOutlet)} /><InfoRow icon={<FiShield aria-hidden="true" />} label="Account status" value={user?.isActive === false ? "Inactive" : "Active"} /><InfoRow icon={<FiCalendar aria-hidden="true" />} label="Joined" value={formatDate(user?.createdAt)} /></div></section>
    </div>
  </div>;
};

export default ProfilePage;
