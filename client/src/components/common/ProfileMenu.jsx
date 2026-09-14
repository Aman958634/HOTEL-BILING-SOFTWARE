import { memo, useEffect, useId, useRef, useState } from "react";
import { FiLogOut, FiSettings, FiUser } from "react-icons/fi";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import useAuth from "../../hooks/useAuth";
import { logoutThunk } from "../../redux/slices/authSlice";

const displayNameFor = (user) => user?.fullName || user?.name || user?.firstName || user?.email || "Account";

const ProfileMenu = ({ compact = false, profilePath = "/profile", settingsPath }) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const menuId = useId();
  const { user } = useAuth();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const displayName = String(displayNameFor(user));
  const role = String(user?.role || "User").replaceAll("_", " ");

  useEffect(() => {
    const onPointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const logout = async () => {
    setOpen(false);
    await dispatch(logoutThunk());
    navigate("/", { replace: true });
  };

  return (
    <div ref={wrapperRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label="Open account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuId : undefined}
        className={compact
          ? "flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-1"
          : "flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-2 py-1.5 text-slate-600 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 focus-visible:ring-offset-1"}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white" aria-hidden="true">
          {displayName.charAt(0).toUpperCase()}
        </span>
        {!compact && (
          <span className="hidden min-w-0 text-left md:block">
            <span className="block max-w-28 truncate text-sm font-medium leading-tight text-slate-900">{displayName}</span>
            <span className="block max-w-28 truncate text-xs capitalize leading-tight text-slate-500">{role}</span>
          </span>
        )}
      </button>

      {open && (
        <div id={menuId} role="menu" aria-label="Account menu" className="profile-menu-panel absolute right-0 z-50 mt-2 w-[min(19rem,calc(100vw-1.5rem))] origin-top-right overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 p-1.5 shadow-[0_18px_42px_rgb(15_23_42_/_0.16)] backdrop-blur-sm">
          <div className="flex min-w-0 items-center gap-3 px-3 py-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white ring-2 ring-slate-100" aria-hidden="true">
              {displayName.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
              <p className="mt-0.5 truncate text-xs text-slate-500">{user?.email || "No email available"}</p>
              <p className="mt-1 truncate text-[11px] font-medium capitalize tracking-wide text-slate-400">{role}</p>
            </div>
          </div>
          <div className="mx-1 border-t border-slate-100" />
          <div className="py-1">
            <Link to={profilePath} role="menuitem" onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300">
              <FiUser className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
              Profile
            </Link>
            {settingsPath && (
              <Link to={settingsPath} role="menuitem" onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300">
                <FiSettings className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
                Settings
              </Link>
            )}
          </div>
          <div className="mx-1 border-t border-slate-100" />
          <div className="pt-1">
            <button type="button" role="menuitem" onClick={logout} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold text-rose-700 transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200">
              <FiLogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(ProfileMenu);