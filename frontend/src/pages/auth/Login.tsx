import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Lock, Mail, Fingerprint, ShieldCheck, UserCheck, Gavel, Megaphone, ShieldHalf, KeyRound, Loader2, Send } from "lucide-react";
import { useAppDispatch, useAppSelector, login, authUserFromBackend, type Role } from "@/redux/store";
import { authApi, isMfaPending } from "@/lib/api/auth";
import { ApiError } from "@/lib/api";
import { invitationsApi } from "@/lib/api/resources";

const ROLES: { key: Role; label: string; email: string; password: string; Icon: any; tag: string }[] = [
  { key: "witness", label: "Witness", email: "witness@gwr.com", password: "Witness@123", Icon: UserCheck, tag: "Independent verification" },
  { key: "adjudicator", label: "Adjudicator", email: "adjudicator@gwr.com", password: "Adjudicator@123", Icon: Gavel, tag: "Official GWR review" },
  { key: "organizer", label: "Organizer", email: "organizer@gwr.com", password: "Organizer@123", Icon: Megaphone, tag: "Event submission" },
  { key: "admin", label: "Admin", email: "admin@gwr.com", password: "Admin@123", Icon: ShieldHalf, tag: "GWR Operations" },
];

export default function Login() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const initialRole: Role = inviteToken ? "witness" : "adjudicator";
  const initialEntry = ROLES.find((r) => r.key === initialRole)!;
  const [role, setRole] = useState<Role>(initialRole);
  const [email, setEmail] = useState(initialEntry.email);
  const [password, setPassword] = useState(initialEntry.password);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const auth = useAppSelector((s) => s.auth);

  // Invitation flow state — populated when ?invite=<token> is present.
  const [inviteLoading, setInviteLoading] = useState(!!inviteToken);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteInfo, setInviteInfo] = useState<null | {
    witnessEmail: string;
    witnessName: string;
    attemptTitle: string;
    status: string;
  }>(null);
  const [inviteEmailInput, setInviteEmailInput] = useState("");
  const [inviteSubmitting, setInviteSubmitting] = useState(false);

  useEffect(() => {
    if (!inviteToken) return;
    let cancelled = false;
    setInviteLoading(true);
    setInviteError(null);
    invitationsApi.resolve(inviteToken)
      .then((r) => {
        if (cancelled) return;
        setInviteInfo({
          witnessEmail: r.witness_email,
          witnessName: r.witness_name,
          attemptTitle: r.attempt_title,
          status: r.status,
        });
      })
      .catch((e: any) => {
        if (cancelled) return;
        setInviteError(
          e instanceof ApiError && e.status === 401
            ? "This invitation link is invalid or has expired."
            : e?.message ?? "Could not load the invitation."
        );
      })
      .finally(() => { if (!cancelled) setInviteLoading(false); });
    return () => { cancelled = true; };
  }, [inviteToken]);

  // If a witness is already signed in and follows an invite link, jump straight in.
  useEffect(() => {
    if (inviteToken && auth.isAuthenticated && auth.user?.role === "witness") {
      navigate(`/witness/invite/${inviteToken}`, { replace: true });
    }
  }, [inviteToken, auth.isAuthenticated, auth.user?.role, navigate]);

  async function onInviteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteToken || !inviteInfo) return;
    setInviteError(null);
    const entered = inviteEmailInput.trim().toLowerCase();
    const expected = (inviteInfo.witnessEmail ?? "").trim().toLowerCase();
    if (!entered) {
      setInviteError("Please enter the email address this invitation was sent to.");
      return;
    }
    if (entered !== expected) {
      setInviteError("That email doesn't match the address this invitation was sent to.");
      return;
    }
    setInviteSubmitting(true);
    try {
      await authApi.verifyMagicLink(inviteToken);
      const me = await authApi.me();
      dispatch(login(authUserFromBackend(me)));
      navigate(`/witness/invite/${inviteToken}`, { replace: true });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.status === 0
            ? "Cannot reach the GWR backend. Start it with `python run.py` from the backend folder."
            : err.message
          : "Could not open the invitation. Please try again.";
      setInviteError(msg);
    } finally {
      setInviteSubmitting(false);
    }
  }

  // MFA challenge (adjudicators with mfa_secret set)
  const [mfaTempToken, setMfaTempToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");

  function pickRole(r: Role) {
    setRole(r);
    const m = ROLES.find((x) => x.key === r)!;
    setEmail(m.email);
    setPassword(m.password);
    setError(null);
    setMfaTempToken(null);
  }

  function finishLogin(navigateRole: Role) {
    if (navigateRole === "witness" && inviteToken) {
      navigate(`/witness/invite/${inviteToken}`);
      return;
    }
    if (navigateRole === "organizer") navigate("/dashboard");
    else if (navigateRole === "witness") navigate("/witness");
    else navigate(`/${navigateRole}/dashboard`);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await authApi.login(email.trim().toLowerCase(), password);
      if (isMfaPending(result)) {
        setMfaTempToken(result.temp_token);
        setLoading(false);
        return;
      }
      // Fetch full user profile
      const me = await authApi.me();
      dispatch(login(authUserFromBackend(me)));
      finishLogin(me.role as Role);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.status === 401
            ? "Invalid email or password."
            : err.status === 0
              ? "Cannot reach the GWR backend at this URL. Start it with `python run.py` from the backend folder."
              : err.message
          : "Unexpected error. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  async function onMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mfaTempToken) return;
    setError(null);
    setLoading(true);
    try {
      await authApi.verifyMfa(mfaTempToken, mfaCode);
      const me = await authApi.me();
      dispatch(login(authUserFromBackend(me)));
      finishLogin(me.role as Role);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Invalid MFA code.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  if (inviteToken) {
    if (inviteLoading) {
      return (
        <div className="w-full max-w-md panel p-8 ring-gold text-center">
          <Loader2 className="h-6 w-6 animate-spin text-royal mx-auto" />
          <p className="text-sm text-muted mt-3">Opening your invitation…</p>
        </div>
      );
    }
    if (!inviteInfo) {
      return (
        <div className="w-full max-w-md panel p-8 ring-gold text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
            <Mail className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold text-soft mt-4">Invitation not found</h2>
          <p className="text-sm text-muted mt-2">
            {inviteError ?? "This invitation link is no longer valid."} Please contact the event organiser.
          </p>
        </div>
      );
    }
    const masked = inviteInfo.witnessEmail
      ? inviteInfo.witnessEmail.replace(/^(.{2}).*(@.*)$/, "$1•••$2")
      : "your email";
    return (
      <form onSubmit={onInviteSubmit} className="w-full max-w-md panel p-5 sm:p-8 ring-gold animate-fadeIn">
        <div className="text-[10px] uppercase tracking-[0.2em] text-royal font-bold mb-2">Witness invitation</div>
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-soft">
          Hello {inviteInfo.witnessName.split(" ")[0] || "there"} —
        </h2>
        <p className="text-sm text-muted mt-1">
          You've been invited to witness <span className="font-semibold text-soft">{inviteInfo.attemptTitle || "a Guinness World Records attempt"}</span>.
          Confirm your email below to open your statement form.
        </p>
        <div className="mt-5">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-muted">Email address this invitation was sent to</span>
            <div className="mt-1 relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <input
                className="input pl-9"
                type="email"
                autoFocus
                placeholder={masked}
                value={inviteEmailInput}
                onChange={(e) => setInviteEmailInput(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
          </label>
          {inviteError && (
            <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3 py-2">{inviteError}</div>
          )}
          {inviteInfo.status === "completed" && (
            <div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-3 py-2">
              You've already submitted this witness statement. Continue to view your submission.
            </div>
          )}
        </div>
        <button disabled={inviteSubmitting} className="btn-primary w-full mt-6">
          {inviteSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Opening…</> : <>Continue to my statement <Send className="h-4 w-4" /></>}
        </button>
        <p className="mt-4 text-[11px] text-muted leading-relaxed">
          We sent this invitation to <span className="font-mono">{masked}</span>. Only that recipient can open the form.
          Your email is verified against the invitation — no separate password is needed.
        </p>
      </form>
    );
  }

  if (mfaTempToken) {
    return (
      <form onSubmit={onMfaSubmit} className="w-full max-w-md panel p-8 ring-gold animate-fadeIn">
        <div className="text-[10px] uppercase tracking-[0.2em] text-royal font-bold mb-2">Multi-factor verification</div>
        <h2 className="text-2xl font-bold tracking-tight text-soft">Enter authenticator code</h2>
        <p className="text-sm text-muted mt-1">
          Your account requires MFA. Open your authenticator app and enter the 6-digit code for{" "}
          <span className="font-semibold text-soft">{email}</span>.
        </p>
        <div className="mt-6">
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-muted">Authenticator code</span>
            <div className="mt-1 relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <input
                className="input pl-9 tracking-[0.5em] text-center font-mono"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                autoFocus
                required
              />
            </div>
          </label>
          {error && (
            <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3 py-2">{error}</div>
          )}
        </div>
        <button disabled={loading || mfaCode.length !== 6} className="btn-primary w-full mt-6">
          {loading ? "Verifying…" : "Verify code"}
        </button>
        <button
          type="button"
          className="text-xs text-muted hover:text-royal mt-3 w-full"
          onClick={() => { setMfaTempToken(null); setMfaCode(""); setError(null); }}
        >
          Cancel and use a different account
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-md panel p-5 sm:p-8 ring-gold animate-fadeIn">
      <div className="text-[10px] uppercase tracking-[0.2em] text-royal font-bold mb-2">Secure Sign In</div>
      <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-soft">Witness &amp; Adjudicator Portal</h2>
      <p className="text-sm text-muted mt-1">Sign in to your authorized GWR verification workspace.</p>
      {inviteToken && (
        <div className="mt-4 rounded-lg bg-royal/[0.06] border border-royal/20 text-royal text-xs px-3 py-2 leading-relaxed">
          <span className="font-semibold">You've been invited as a witness.</span> Sign in with your witness
          account to open the invitation. For the demo environment, use <span className="font-mono">witness@gwr.com</span> / <span className="font-mono">Witness@123</span>.
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {ROLES.map((r) => {
          const active = role === r.key;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => pickRole(r.key)}
              className={`rounded-xl border px-3 py-3 text-left transition ${
                active ? "border-royal bg-royal/[0.06]" : "border-line bg-white hover:border-royal/40"
              }`}
            >
              <r.Icon className={`h-4 w-4 ${active ? "text-royal" : "text-muted"}`} />
              <div className={`mt-2 text-[12px] font-semibold ${active ? "text-royal" : "text-soft"}`}>{r.label}</div>
              <div className="text-[10px] text-muted leading-tight">{r.tag}</div>
            </button>
          );
        })}
      </div>

      <div className="mt-5 space-y-3">
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-muted">Work email</span>
          <div className="mt-1 relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              className="input pl-9"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </div>
        </label>
        <label className="block">
          <span className="text-[11px] uppercase tracking-wider text-muted">Password</span>
          <div className="mt-1 relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              className="input pl-9"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
        </label>
        {error && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3 py-2">
            {error}
          </div>
        )}
        <div className="flex items-center justify-between text-xs">
          <label className="inline-flex items-center gap-2 text-muted">
            <input type="checkbox" defaultChecked className="accent-royal" /> Trusted device
          </label>
          <span className="text-royal/70">SSO &middot; SAML available</span>
        </div>
      </div>

      <button disabled={loading} className="btn-primary w-full mt-6">
        {loading ? "Verifying credentials…" : <>Sign in securely <Fingerprint className="h-4 w-4" /></>}
      </button>

      <div className="mt-5 rounded-lg bg-canvas border border-line p-3 text-[11px] text-muted leading-relaxed">
        <div className="font-semibold text-soft mb-1.5">Sample credentials</div>
        <div className="grid grid-cols-1 gap-1">
          <div><span className="text-royal font-medium">Witness</span> &middot; witness@gwr.com / Witness@123</div>
          <div><span className="text-royal font-medium">Adjudicator</span> &middot; adjudicator@gwr.com / Adjudicator@123</div>
          <div><span className="text-royal font-medium">Organizer</span> &middot; organizer@gwr.com / Organizer@123</div>
          <div><span className="text-royal font-medium">Admin</span> &middot; admin@gwr.com / Admin@123</div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-muted">
        <ShieldCheck className="h-3.5 w-3.5 text-royal" /> Protected by multi-factor authentication &amp; SOC 2 Type II controls
      </div>
    </form>
  );
}
