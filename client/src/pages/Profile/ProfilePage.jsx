import { useState } from "react";
import { FiBriefcase, FiCalendar, FiMail, FiMapPin, FiPhone, FiShield, FiUser } from "react-icons/fi";
import { useSelector } from "react-redux";

const nameFrom = (value) => {
  if (typeof value === "string") return value;
  return value && typeof value === "object" ? value.name || value.outletName || value.title : undefined;
};
const label = (value) => String(value || "User").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const formatDate = (value) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
};

const InfoRow = ({ icon, label: rowLabel, value }) => {
  if (!value) return null;

  return <div className="min-w-0 rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 transition-colors hover:border-slate-200 hover:bg-white">
    <div className="flex min-w-0 items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">{rowLabel}</p>
        <p className="mt-1 break-words text-sm font-semibold leading-5 text-slate-800">{value}</p>
      </div>
    </div>
  </div>;
};

const ProfilePage = () => {
  const { user, authorizedOutlets, activeOutletId } = useSelector((state) => state.auth);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const fullName = user?.fullName || user?.name || "Account";
  const avatar = user?.avatar || user?.profilePhoto;
  const activeOutlet = (authorizedOutlets || []).find((outlet) => String(outlet?._id) === String(activeOutletId));
  const initials = fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "A";

  const personalDetails = [
    { icon: <FiUser aria-hidden="true" />, label: "Full name", value: fullName },
    { icon: <FiMail aria-hidden="true" />, label: "Email", value: user?.email },
    { icon: <FiPhone aria-hidden="true" />, label: "Phone", value: user?.phone },
    { icon: <FiBriefcase aria-hidden="true" />, label: "Role", value: user?.role ? label(user.role) : undefined },
  ];
  const accountDetails = [
    { icon: <FiMapPin aria-hidden="true" />, label: "Restaurant", value: nameFrom(user?.restaurant) },
    { icon: <FiMapPin aria-hidden="true" />, label: "Active outlet", value: nameFrom(activeOutlet) },
    { icon: <FiShield aria-hidden="true" />, label: "Account status", value: user?.isActive === false ? "Inactive" : "Active" },
    { icon: <FiCalendar aria-hidden="true" />, label: "Joined", value: formatDate(user?.createdAt) },
  ];

  return <div className="mx-auto max-w-5xl space-y-4 pb-12 sm:space-y-5">
    <section className="relative overflow-hidden rounded-2xl border border-emerald-100/90 bg-gradient-to-br from-emerald-50 via-white to-slate-50 p-5 shadow-sm sm:p-6">
      <div aria-hidden="true" className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-emerald-100/50 blur-2xl" />
      <div className="relative flex flex-col items-center gap-4 text-center sm:flex-row sm:gap-5 sm:text-left">
        <div className="shrink-0 rounded-[1.35rem] bg-white p-1.5 shadow-[0_8px_22px_rgb(15_23_42_/_0.10)] ring-1 ring-emerald-100">
          {avatar && !avatarFailed ? <img src={avatar} alt={`${fullName} profile`} onError={() => setAvatarFailed(true)} className="h-20 w-20 rounded-2xl object-cover sm:h-[5.5rem] sm:w-[5.5rem]" /> : <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-700 text-xl font-bold tracking-tight text-white sm:h-[5.5rem] sm:w-[5.5rem] sm:text-2xl" aria-label={`${fullName} initials`}>{initials}</div>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-700">RestoSphere account</p>
          <h1 className="mt-1.5 break-words text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{fullName}</h1>
          {user?.email ? <p className="mt-1 break-words text-sm text-slate-600">{user.email}</p> : <p className="mt-1 text-sm text-slate-500">Account overview</p>}
          {user?.role ? <span className="mt-3 inline-flex items-center rounded-full border border-emerald-200 bg-white/80 px-2.5 py-1 text-xs font-semibold text-emerald-800 shadow-sm">{label(user.role)}</span> : null}
        </div>
      </div>
    </section>

    <div className="grid gap-4 lg:grid-cols-2">
      <section className="ui-card p-4 sm:p-5">
        <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Account details</p><h2 className="mt-1 text-lg font-bold text-slate-900">Personal information</h2><p className="mt-1 text-sm text-slate-500">Your contact and role details.</p></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">{personalDetails.map((detail) => <InfoRow key={detail.label} {...detail} />)}</div>
      </section>
      <section className="ui-card p-4 sm:p-5">
        <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Workspace</p><h2 className="mt-1 text-lg font-bold text-slate-900">Account information</h2><p className="mt-1 text-sm text-slate-500">Your restaurant access and account status.</p></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">{accountDetails.map((detail) => <InfoRow key={detail.label} {...detail} />)}</div>
      </section>
    </div>
  </div>;
};

export default ProfilePage;
