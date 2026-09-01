import { memo, useEffect, useRef, useState } from "react";
import { FiLogOut, FiSettings, FiUser } from "react-icons/fi";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import useAuth from "../../hooks/useAuth";
import { logoutThunk } from "../../redux/slices/authSlice";

const displayNameFor = (user) => user?.fullName || user?.name || user?.firstName || user?.email || "Account";

const ProfileMenu = ({ compact = false, profilePath = "/profile", settingsPath }) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
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
        className={compact
          ? "flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100"
          : "flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-2 py-1.5 text-slate-600 transition hover:bg-slate-50"}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-xs font-bold text-white" aria-hidden="true">
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
        <div role="menu" aria-label="Account menu" className="absolute right-0 z-50 mt-2 w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          <div className="min-w-0 border-b border-slate-100 px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-slate-900">{displayName}</p>
            <p className="truncate text-xs text-slate-500">{user?.email || role}</p>
          </div>
          <div className="py-1">
            <Link to={profilePath} role="menuitem" onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <FiUser className="h-4 w-4 shrink-0" />
              Profile
            </Link>
            {settingsPath && (
              <Link to={settingsPath} role="menuitem" onClick={() => setOpen(false)} className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <FiSettings className="h-4 w-4 shrink-0" />
                Settings
              </Link>
            )}
          </div>
          <div className="border-t border-slate-100 pt-1">
            <button type="button" role="menuitem" onClick={logout} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium text-rose-700 hover:bg-rose-50">
              <FiLogOut className="h-4 w-4 shrink-0" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(ProfileMenu);
