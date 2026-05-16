import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Trophy, ShieldCheck, ChevronDown, LogOut, KeyRound, Mail, X } from "lucide-react";
import { useAppDispatch, useAppSelector, logout } from "@/redux/store";

export default function WitnessLayout() {
  const auth = useAppSelector((s) => s.auth);
  const dispatch = useAppDispatch();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Magic-link invitations are public — no auth required for /witness/invite/:token
  const isMagicLink = location.pathname.startsWith("/witness/invite/");

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!isMagicLink) {
    if (!auth.isAuthenticated || !auth.user) return <Navigate to="/login" replace />;
    if (auth.user.role !== "witness") {
      return <Navigate to={auth.user.role === "organizer" ? "/dashboard" : `/${auth.user.role}/dashboard`} replace />;
    }
  }

  const user = auth.user;

  return (
    <div className="min-h-screen bg-canvas flex flex-col">
      <header className="sticky top-0 z-20 h-16 bg-white border-b border-line flex items-center px-4 sm:px-6 lg:px-10">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-royal flex items-center justify-center">
            <Trophy className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-royal font-bold">Guinness World Records</div>
            <div className="text-sm font-bold text-soft leading-tight">Witness Statement Portal</div>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 chip ml-6">
          <ShieldCheck className="h-3.5 w-3.5 text-royal" />
          Secure session &middot; TLS 1.3
        </div>

        <div className="ml-auto relative" ref={menuRef}>
          {user ? (
            <>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-3 pl-2 pr-3 py-1.5 rounded-xl hover:bg-canvas transition"
          >
            <div className="h-9 w-9 rounded-full bg-royal text-white flex items-center justify-center font-semibold text-sm">
              {user.avatarInitials}
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-sm font-semibold leading-tight text-soft">{user.name}</div>
              <div className="text-[11px] text-muted">{user.roleLabel}</div>
            </div>
            <ChevronDown className="h-4 w-4 text-muted" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 panel !p-2 shadow-panel z-50">
              <div className="px-3 py-2 border-b border-line">
                <div className="text-sm font-semibold text-soft">{user.name}</div>
                <div className="text-[11px] text-muted truncate">{user.email}</div>
                <div className="text-[11px] text-muted">{user.organization}</div>
              </div>
              <button
                onClick={() => { setMenuOpen(false); setProfileOpen(true); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-canvas text-sm text-soft"
              >
                <Mail className="h-4 w-4 text-muted" /> Edit profile
              </button>
              <button
                onClick={() => { setMenuOpen(false); setProfileOpen(true); }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-canvas text-sm text-soft"
              >
                <KeyRound className="h-4 w-4 text-muted" /> Change password
              </button>
              <div className="border-t border-line my-1" />
              <button
                onClick={() => dispatch(logout())}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-rose-50 text-sm text-rose-700"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          )}
            </>
          ) : (
            <div className="chip"><ShieldCheck className="h-3 w-3 text-royal" /> Invitation access</div>
          )}
        </div>
      </header>

      <main className="flex-1 px-6 lg:px-10 py-8 lg:py-10 max-w-5xl w-full mx-auto animate-fadeIn">
        <Outlet />
      </main>

      <footer className="border-t border-line bg-white py-4 px-6 lg:px-10 text-[11px] text-muted">
        &copy; {new Date().getFullYear()} Guinness World Records Limited &middot; Confidential witness verification system
      </footer>

      {profileOpen && user && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 flex items-center justify-center p-4" onClick={() => setProfileOpen(false)}>
          <div className="panel max-w-lg w-full !p-0" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-line flex items-center justify-between">
              <div className="font-semibold text-soft">Profile &amp; security</div>
              <button onClick={() => setProfileOpen(false)} className="btn-ghost !p-1.5"><X className="h-4 w-4" /></button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <Field label="Full name" defaultValue={user.name} />
              <Field label="Email" defaultValue={user.email} />
              <Field label="Organization" defaultValue={user.organization} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Current password" type="password" />
                <Field label="New password" type="password" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setProfileOpen(false)} className="btn-ghost border border-line">Cancel</button>
                <button onClick={() => setProfileOpen(false)} className="btn-primary">Save changes</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, ...p }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-muted">{label}</span>
      <input className="input mt-1" {...p} />
    </label>
  );
}
