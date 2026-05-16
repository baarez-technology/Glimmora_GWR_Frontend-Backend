import { useRef, useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import {
  CheckCircle2, ClipboardSignature, Eraser, Pencil, Upload, Type, ShieldCheck, FileDown, Loader2,
  MessageSquareWarning, MapPin, Calendar, Users, BookOpen, Send, ChevronDown, ChevronUp, Mail,
} from "lucide-react";
import { Badge, Card, Button, Progress } from "@/components/ui";
import { attempts, witnesses, clarifications, witnessWorkflowSteps } from "@/mock-data/portal";
import { useAppDispatch, useAppSelector } from "@/redux/store";
import { addInvitations, markSubmitted, type InvitationStatement } from "@/redux/invitations";
import { api } from "@/lib/api";
import { invitationsApi, type WitnessInvitationOut } from "@/lib/api/resources";
import { downloadFilledWitnessStatement, type WitnessStatementFill } from "@/lib/witnessStatementPdf";
import { formatDate } from "@/lib/utils";
import { Link } from "react-router-dom";

type SigMode = "draw" | "type" | "upload";

export default function WitnessPortal() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((s) => s.auth.user);
  const { token } = useParams();
  const allInvitations = useAppSelector((s) => s.invitations.items);
  const invitation = useMemo(
    () => (token ? allInvitations.find((i) => i.token === token) : undefined),
    [token, allInvitations]
  );

  // If the witness opens a magic link (no prior redux state), hydrate from the backend.
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [backendAttempt, setBackendAttempt] = useState<null | {
    id: string; title: string; venue: string; city: string; country: string;
    startISO: string; endISO: string; description: string;
    organizer: string; category: string; participantCount: number; guidelinesRef: string;
    witnessIds: string[];
  }>(null);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setResolving(true);
    invitationsApi.resolve(token)
      .then((r) => {
        if (cancelled) return;
        const loc = r.attempt_location ?? "";
        const parts = loc.split(",").map((s) => s.trim()).filter(Boolean);
        const city = parts.length >= 2 ? parts[parts.length - 2] : parts[0] ?? "";
        const country = parts[parts.length - 1] ?? "";
        const venue = parts.length >= 2 ? parts.slice(0, -2).join(", ") : loc;
        setBackendAttempt({
          id: r.attempt_id,
          title: r.attempt_title,
          venue: venue || loc,
          city,
          country,
          startISO: r.attempt_date ?? new Date().toISOString(),
          endISO: r.attempt_date ?? new Date().toISOString(),
          description: r.attempt_description ?? "",
          organizer: "GWR Records",
          category: r.attempt_category ?? "",
          participantCount: 0,
          guidelinesRef: "GWR official guidelines",
          witnessIds: [],
        });
        if (!invitation) {
          dispatch(addInvitations([{
            id: r.witness_id,
            token,
            attemptId: r.attempt_id,
            witnessName: r.witness_name,
            witnessEmail: r.witness_email,
            expertise: r.witness_expertise ?? r.witness_role,
            status: r.status === "completed" ? "Submitted" : "Pending",
            sentAt: new Date().toISOString(),
            organizerName: "",
          }]));
        }
      })
      .catch((e: any) => {
        if (!cancelled) setResolveError(e?.message ?? "Could not resolve invitation");
      })
      .finally(() => { if (!cancelled) setResolving(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Invitation-driven witness identity (magic link) overrides the logged-in witness.
  // Mock arrays may be empty (real data lives in the backend); provide safe fallbacks
  // so the page renders an empty state instead of crashing.
  const FALLBACK_WITNESS = {
    id: "self", firstName: "", lastName: "", email: user?.email ?? "", organization: "", expertise: "", country: "",
  } as any;
  const FALLBACK_ATTEMPT = {
    id: "", title: "", venue: "", city: "", country: "", startISO: new Date().toISOString(), endISO: new Date().toISOString(), witnessIds: [] as string[],
  } as any;

  const me = useMemo(
    () => witnesses.find((w) => w.email === (invitation?.witnessEmail ?? user?.email)) ?? witnesses[0] ?? FALLBACK_WITNESS,
    [invitation, user?.email]
  );
  const myAttempts = useMemo(
    () => (invitation
      ? attempts.filter((a) => a.id === invitation.attemptId)
      : attempts.filter((a) => a.witnessIds?.includes(me.id))),
    [me.id, invitation]
  );

  const [attemptId, setAttemptId] = useState(
    invitation?.attemptId ?? myAttempts[0]?.id ?? attempts[0]?.id ?? ""
  );
  useEffect(() => {
    if (backendAttempt?.id && attemptId !== backendAttempt.id) setAttemptId(backendAttempt.id);
  }, [backendAttempt?.id]);
  const attempt = backendAttempt
    ?? attempts.find((a) => a.id === attemptId)
    ?? attempts[0]
    ?? FALLBACK_ATTEMPT;
  const myClarifications = invitation
    ? [] // magic-link visitors don't see legacy mock clarifications
    : clarifications.filter((c) => c.witnessId === me.id && c.status !== "Closed");

  const invalidToken = !!token && !invitation && !resolving && !!resolveError;
  const alreadySubmitted = invitation?.status === "Submitted" || invitation?.status === "Approved" || invitation?.status === "Rejected";

  /* ---------------- form state ---------------- */
  const sourceName = invitation?.witnessName ?? user?.name ?? "";
  const [firstName, setFirstName] = useState(sourceName.split(" ").slice(0, -1).join(" ") || sourceName);
  const [lastName, setLastName] = useState(sourceName.split(" ").slice(-1).join(" ") || "");
  const [organisation, setOrganisation] = useState(me.organization);
  const [expertise, setExpertise] = useState(invitation?.expertise || me.expertise);
  const [nationality, setNationality] = useState(me.country);
  const [email, setEmail] = useState(invitation?.witnessEmail ?? user?.email ?? "");
  const [telephone, setTelephone] = useState("+44 20 7946 0017");
  const [recordTitle, setRecordTitle] = useState(attempt.title);
  const [applicationRef, setApplicationRef] = useState(attempt.id);
  const [witnessDetails, setWitnessDetails] = useState("");
  const [finalMeasurement, setFinalMeasurement] = useState("");
  const [venue, setVenue] = useState(attempt.venue);
  const [cityTown, setCityTown] = useState(attempt.city);
  const [country, setCountry] = useState(attempt.country);
  const [presentDates, setPresentDates] = useState("");
  const [completedDate, setCompletedDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Sync identity fields once an invitation lands (e.g. after backend resolve)
  useEffect(() => {
    if (!invitation) return;
    const name = invitation.witnessName ?? "";
    const parts = name.trim().split(/\s+/);
    setFirstName(parts.slice(0, -1).join(" ") || parts[0] || "");
    setLastName(parts.length > 1 ? parts[parts.length - 1] : "");
    if (invitation.witnessEmail) setEmail(invitation.witnessEmail);
    if (invitation.expertise) setExpertise(invitation.expertise);
  }, [invitation?.token]);

  // Re-sync record-derived fields when the witness picks a different attempt
  useEffect(() => {
    setRecordTitle(attempt.title);
    setApplicationRef(attempt.id);
    setVenue(attempt.venue);
    setCityTown(attempt.city);
    setCountry(attempt.country);
    setPresentDates(`From ${new Date(attempt.startISO).toLocaleString()} to ${new Date(attempt.endISO).toLocaleString()} (UTC).`);
    setWitnessDetails(
      `I personally observed the entire attempt at ${attempt.venue} on ${new Date(attempt.startISO).toDateString()}. All Guinness World Records guidelines were strictly followed throughout the attempt, including continuous coverage, approved measurement methods and accredited timekeeping.`
    );
  }, [attemptId, attempt]);

  const [sigMode, setSigMode] = useState<SigMode>("draw");
  const [typedSig, setTypedSig] = useState(user?.name ?? "");
  const [uploadedDataUrl, setUploadedDataUrl] = useState<string | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState({ rules: false, measurements: false, attendance: false, timeline: false });
  const [submitted, setSubmitted] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [showAttemptInfo, setShowAttemptInfo] = useState(true);

  // Logged-in witness (no magic-link token in URL): pull pending invitations
  // straight from the backend so they can pick one without needing the email.
  const [myInvitations, setMyInvitations] = useState<WitnessInvitationOut[] | null>(null);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const loggedInWithoutToken = !!user && !token;
  useEffect(() => {
    if (!loggedInWithoutToken) return;
    let cancelled = false;
    setInvitationsLoading(true);
    invitationsApi.mine()
      .then((rows) => { if (!cancelled) setMyInvitations(rows); })
      .catch(() => { if (!cancelled) setMyInvitations([]); })
      .finally(() => { if (!cancelled) setInvitationsLoading(false); });
    return () => { cancelled = true; };
  }, [loggedInWithoutToken]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.strokeStyle = "#0057B8";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = canvasRef.current!.getBoundingClientRect();
    const c = canvasRef.current!;
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  }
  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    const { x, y } = pos(e);
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.beginPath();
    ctx.moveTo(x, y);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const { x, y } = pos(e);
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasInk(true);
  }
  function end() { drawing.current = false; }
  function clearCanvas() {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setHasInk(false);
  }

  function readImageAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }
  async function onUploadSig(file?: File | null) {
    if (!file) return;
    setUploadedName(file.name);
    setUploadedDataUrl(await readImageAsDataUrl(file));
  }
  function buildSignatureDataUrl(): string | undefined {
    if (sigMode === "draw") {
      const c = canvasRef.current;
      if (!c || !hasInk) return undefined;
      return c.toDataURL("image/png");
    }
    if (sigMode === "type") {
      if (!typedSig.trim()) return undefined;
      const c = document.createElement("canvas");
      c.width = 600; c.height = 160;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = "#0057B8";
      ctx.font = "italic 64px 'Times New Roman', serif";
      ctx.textBaseline = "middle";
      ctx.fillText(typedSig, 20, c.height / 2);
      return c.toDataURL("image/png");
    }
    return uploadedDataUrl ?? undefined;
  }

  const allAck = Object.values(acknowledged).every(Boolean);
  const hasSig = (sigMode === "draw" && hasInk) || (sigMode === "type" && typedSig.trim().length > 1) || (sigMode === "upload" && !!uploadedDataUrl);
  const profileOk = !!firstName && !!lastName && !!email;
  const statementOk = witnessDetails.length > 20 && !!finalMeasurement && expertise.length > 2;
  const canSubmit = profileOk && statementOk && allAck && hasSig;

  // Workflow stepper: derive current step from state
  const currentStep =
    submitted ? 3 :
    canSubmit ? 2 :          // signed & ready → "Pending Approval" is the active card
    statementOk ? 1 :        // profile + statement done → "Profile Submitted"
    0;                       // just invited

  async function handleDownload() {
    setDownloadError(null);
    setDownloading(true);
    try {
      const fill: WitnessStatementFill = {
        declarationName: `${firstName} ${lastName}`.trim(),
        recordTitle, applicationRef, firstName, lastName, organisation, nationality, email, telephone,
        witnessDetails, expertise, finalMeasurement, venue, cityTown, country, presentDates,
        completedISO: new Date(completedDate).toISOString(),
        signatureDataUrl: buildSignatureDataUrl(),
      };
      const safeName = (`${firstName}_${lastName}` || "Witness").replace(/[^A-Za-z0-9_-]+/g, "_");
      await downloadFilledWitnessStatement(fill, `GWR_Witness_Statement_${safeName}.pdf`);
    } catch (e: any) {
      setDownloadError(e?.message ?? "Could not generate PDF.");
    } finally {
      setDownloading(false);
    }
  }
  async function handleSubmit() {
    setDownloadError(null);
    setDownloading(true);
    try {
      await handleDownload();
      const statement: InvitationStatement = {
        recordTitle, applicationRef, firstName, lastName, organisation, nationality, email, telephone,
        witnessDetails, expertise, finalMeasurement, venue, cityTown, country, presentDates,
        completedISO: new Date(completedDate).toISOString(),
        signatureDataUrl: buildSignatureDataUrl(),
      };
      if (token) {
        try {
          await api.post(`/invitations/${token}/statement`, {
            fields: statement,
            signature_png: statement.signatureDataUrl,
          });
        } catch (e: any) {
          setDownloadError(e?.message ?? "Failed to submit statement to server.");
          return;
        }
      }
      if (invitation) {
        dispatch(markSubmitted({ token: invitation.token, statement }));
      }
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setDownloading(false);
    }
  }

  /* ---------------- logged-in witness without a magic-link token: show their invitations ---------------- */
  if (loggedInWithoutToken && !invitation) {
    if (invitationsLoading || myInvitations === null) {
      return (
        <Card className="text-center py-14">
          <Loader2 className="h-6 w-6 animate-spin text-muted mx-auto" />
          <p className="text-sm text-muted mt-3">Loading your invitations…</p>
        </Card>
      );
    }
    if (myInvitations.length === 0) {
      return (
        <Card className="text-center py-14">
          <div className="mx-auto h-14 w-14 rounded-full bg-royal/10 text-royal flex items-center justify-center mb-4">
            <Mail className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-soft">No witness invitations yet</h2>
          <p className="text-sm text-muted mt-2 max-w-md mx-auto">
            When an organizer invites you to witness a Guinness World Records attempt, your invitation will appear here automatically. You'll also receive an email with a secure sign-in link.
          </p>
          <p className="text-[11px] text-muted mt-4">
            Signed in as <span className="font-semibold text-soft">{user?.email}</span>. Organizers must invite this exact email.
          </p>
        </Card>
      );
    }
    return (
      <div className="space-y-4">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-soft">Your witness invitations</h2>
              <p className="text-sm text-muted mt-1">{myInvitations.length} invitation{myInvitations.length === 1 ? "" : "s"} addressed to {user?.email}.</p>
            </div>
            <Badge tone="blue">{myInvitations.filter((i) => i.status !== "completed").length} pending</Badge>
          </div>
        </Card>
        <ul className="space-y-3">
          {myInvitations.map((inv) => {
            const done = inv.status === "completed";
            const decision = inv.decision;
            return (
              <Card key={inv.witness_id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">{inv.witness_role}</div>
                    <div className="font-semibold text-soft text-base mt-0.5">{inv.attempt_title || "Untitled attempt"}</div>
                    <div className="text-[12px] text-muted mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      {inv.attempt_location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {inv.attempt_location}</span>}
                      {inv.attempt_date && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(inv.attempt_date)}</span>}
                      {inv.invited_at && <span>Invited {formatDate(inv.invited_at)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge tone={decision === "approved" ? "green" : decision === "rejected" ? "red" : done ? "blue" : "amber"}>
                      {decision ?? (done ? "Submitted" : inv.status === "invited" ? "Pending" : inv.status)}
                    </Badge>
                    {inv.token && !done && (
                      <Link to={`/witness/invite/${inv.token}`}>
                        <Button variant="gold"><Send className="h-4 w-4" /> Open invitation</Button>
                      </Link>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </ul>
      </div>
    );
  }

  /* ---------------- no invitation & no data: friendly empty state (legacy / public) ---------------- */
  if (!token && !invitation && attempts.length === 0) {
    return (
      <Card className="text-center py-14">
        <div className="mx-auto h-14 w-14 rounded-full bg-royal/10 text-royal flex items-center justify-center mb-4">
          <Mail className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-soft">No witness invitations yet</h2>
        <p className="text-sm text-muted mt-2 max-w-md mx-auto">
          When an organizer invites you to witness a Guinness World Records attempt, you'll receive an email with a secure
          sign-in link. Open the link from that email to access your statement form here.
        </p>
        <p className="text-[11px] text-muted mt-4">
          If you were expecting an invitation, check your inbox (and spam folder) for an email from <span className="font-semibold text-soft">GWR Records</span>.
        </p>
      </Card>
    );
  }

  /* ---------------- token present, still resolving ---------------- */
  if (token && !invitation && resolving) {
    return (
      <Card className="text-center py-14">
        <Loader2 className="h-6 w-6 animate-spin text-muted mx-auto" />
        <p className="text-sm text-muted mt-3">Opening your invitation…</p>
      </Card>
    );
  }

  /* ---------------- invalid magic link ---------------- */
  if (invalidToken) {
    return (
      <Card className="text-center py-14">
        <div className="mx-auto h-14 w-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
          <Mail className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-soft">Invitation not found</h2>
        <p className="text-sm text-muted mt-2 max-w-md mx-auto">
          This witness invitation link is no longer valid &mdash; it may have been revoked by the organizer
          or this device may not have access to the saved invitations.
        </p>
        <p className="text-[11px] text-muted mt-4">If you believe this is an error, contact the event organizer.</p>
      </Card>
    );
  }

  /* ---------------- already submitted via magic link ---------------- */
  if (invitation && alreadySubmitted && !submitted) {
    return (
      <Card className="text-center py-14">
        <div className="mx-auto h-14 w-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-soft">Your statement is already submitted</h2>
        <p className="text-sm text-muted mt-2 max-w-md mx-auto">
          Thank you, {invitation.witnessName.split(" ")[0]}. Your statement for{" "}
          <span className="font-semibold text-soft">{attempt.title}</span> was received on{" "}
          {invitation.submittedAt && formatDate(invitation.submittedAt)}.
        </p>
        <div className="mt-4">
          <Badge tone={invitation.status === "Approved" ? "green" : invitation.status === "Rejected" ? "red" : "blue"}>
            {invitation.status}
          </Badge>
        </div>
        {invitation.reviewNote && (
          <p className="mt-4 text-sm text-soft max-w-md mx-auto italic">&ldquo;{invitation.reviewNote}&rdquo;</p>
        )}
      </Card>
    );
  }

  /* ---------------- success state ---------------- */
  if (submitted) {
    return (
      <Card className="text-center py-14">
        <div className="mx-auto h-14 w-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-soft">Thank you, {user?.name?.split(" ")[0]}.</h2>
        <p className="text-sm text-muted mt-2 max-w-md mx-auto">
          Your statement for <span className="font-semibold text-soft">{recordTitle}</span> has been
          securely submitted to Guinness World Records. The official filled PDF was downloaded to
          your device for your records.
        </p>
        <div className="mt-6 inline-flex items-center gap-2 chip">
          <ShieldCheck className="h-3.5 w-3.5 text-royal" /> Statement #STMT-{Math.floor(Math.random() * 90000) + 10000}
        </div>
        <div className="mt-2 text-[11px] text-muted">You may now safely close this window.</div>
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="outline" onClick={handleDownload} disabled={downloading}>
            <FileDown className="h-4 w-4" /> Re-download PDF
          </Button>
          {myAttempts.length > 1 && (
            <Button onClick={() => { setSubmitted(false); clearCanvas(); }}>Submit another statement</Button>
          )}
        </div>
      </Card>
    );
  }

  /* ---------------- main view ---------------- */
  return (
    <div className="space-y-6">
      {/* INVITATION BANNER */}
      <div className="rounded-2xl bg-gradient-to-br from-royal to-royal-400 text-white p-6 lg:p-8 relative overflow-hidden">
        <div className="absolute -top-24 -right-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="relative">
          <div className="flex flex-wrap items-start gap-3 justify-between">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.22em] text-gold-300 font-bold">
                You&rsquo;ve been invited to act as a witness
              </div>
              <h1 className="text-2xl lg:text-[28px] font-bold mt-2 leading-tight">{attempt.title}</h1>
              <div className="text-sm text-white/85 mt-1">
                Invited by <span className="font-semibold text-white">{attempt.organizer.split("—")[0].trim()}</span> &middot; {attempt.id}
              </div>
            </div>
            <Badge tone="gold" className="!bg-white/15 !text-gold-300 !border-white/30">{attempt.category}</Badge>
          </div>

          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Meta Icon={MapPin}>{attempt.city}, {attempt.country}</Meta>
            <Meta Icon={Calendar}>{formatDate(attempt.startISO)}</Meta>
            <Meta Icon={Users}>{attempt.participantCount.toLocaleString()} participants</Meta>
            <Meta Icon={BookOpen}>{attempt.guidelinesRef}</Meta>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <a
              href="/witness-statement-template-2022.pdf" target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-white/15 hover:bg-white/25 border border-white/30 px-3 py-2 text-sm font-semibold transition"
            >
              <FileDown className="h-4 w-4" /> View blank GWR template
            </a>
            {myAttempts.length > 1 && (
              <label className="inline-flex items-center gap-2 rounded-lg bg-white/15 hover:bg-white/25 border border-white/30 px-3 py-2 text-sm font-semibold transition cursor-pointer">
                Switch attempt
                <select
                  value={attemptId} onChange={(e) => setAttemptId(e.target.value)}
                  className="bg-transparent outline-none text-white"
                >
                  {myAttempts.map((a) => <option key={a.id} value={a.id} className="text-soft">{a.id}</option>)}
                </select>
              </label>
            )}
            <button
              onClick={() => setShowAttemptInfo((v) => !v)}
              className="inline-flex items-center gap-1 text-sm text-white/80 hover:text-white"
            >
              {showAttemptInfo ? <>Hide attempt details <ChevronUp className="h-3.5 w-3.5" /></> : <>Show attempt details <ChevronDown className="h-3.5 w-3.5" /></>}
            </button>
          </div>

          {showAttemptInfo && (
            <p className="text-sm text-white/85 mt-4 leading-relaxed max-w-3xl">{attempt.description}</p>
          )}
        </div>
      </div>

      {/* WORKFLOW STEPPER */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted font-semibold">Your progress</div>
            <h3 className="text-base font-bold text-soft mt-0.5">
              {currentStep === 0 && "Step 1 of 4 — please complete your statement below"}
              {currentStep === 1 && "Step 2 of 4 — review declarations and sign"}
              {currentStep === 2 && "Step 3 of 4 — ready to submit"}
            </h3>
          </div>
          <div className="hidden md:block text-right">
            <Progress value={((currentStep + 1) / 4) * 100} tone="blue" />
            <div className="text-[11px] text-muted mt-1">{Math.round(((currentStep + 1) / 4) * 100)}% complete</div>
          </div>
        </div>
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {witnessWorkflowSteps.map((s, i) => {
            const state = i < currentStep ? "done" : i === currentStep ? "active" : "pending";
            return (
              <li key={s.key} className={`rounded-xl border p-3 ${
                state === "active" ? "border-royal/40 bg-royal/[0.04]" :
                state === "done" ? "border-emerald-200 bg-emerald-50/50" : "border-line bg-canvas"
              }`}>
                <div className="flex items-center gap-2">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    state === "done" ? "bg-emerald-100 text-emerald-700" :
                    state === "active" ? "bg-royal text-white" : "bg-white text-muted border border-line"
                  }`}>
                    {state === "done" ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  <div className="text-sm font-semibold text-soft">{s.label}</div>
                </div>
                <p className="text-[11px] text-muted mt-1.5 leading-snug">{s.description}</p>
              </li>
            );
          })}
        </ol>
      </Card>

      {/* CLARIFICATIONS — inline, only when present */}
      {myClarifications.length > 0 && (
        <Card className="!border-amber-200 !bg-amber-50/40">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <MessageSquareWarning className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-amber-900">
                {myClarifications.length === 1 ? "An adjudicator has requested a clarification" : `${myClarifications.length} clarifications need your response`}
              </h3>
              <ul className="mt-2 space-y-3">
                {myClarifications.map((c) => (
                  <li key={c.id} className="rounded-lg bg-white border border-amber-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold text-soft">{c.subject}</div>
                      <Badge tone={c.status === "Open" ? "amber" : "blue"}>{c.status}</Badge>
                    </div>
                    <div className="text-[11px] text-muted mt-1">From {c.from} &middot; opened {formatDate(c.openedAt)}</div>
                    <p className="text-sm text-soft mt-2">{c.preview}</p>
                    <div className="mt-3 flex items-center gap-2">
                      <input className="input flex-1" placeholder="Type your response&hellip;" />
                      <button className="btn-primary"><Send className="h-4 w-4" /> Reply</button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* STATEMENT FORM */}
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-soft text-lg">Your witness statement</h3>
            <p className="text-xs text-muted mt-0.5">
              Maps directly to the official GWR Witness Statement Template (2022) &mdash; on submit, the
              filled PDF is generated and downloaded.
            </p>
          </div>
          <Badge tone="blue"><ClipboardSignature className="h-3 w-3" /> Legally binding</Badge>
        </div>

        <div className="mt-6 space-y-6">
          <Section title="1 · Declaration & record identifiers">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Lab label="Record Title"><input className="input" value={recordTitle} onChange={(e) => setRecordTitle(e.target.value)} /></Lab>
              <Lab label="Application Reference Number"><input className="input" value={applicationRef} onChange={(e) => setApplicationRef(e.target.value)} /></Lab>
            </div>
          </Section>

          <Section title="2 · Your contact details">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Lab label="First name"><input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} /></Lab>
              <Lab label="Last name"><input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} /></Lab>
              <Lab label="Organisation"><input className="input" value={organisation} onChange={(e) => setOrganisation(e.target.value)} /></Lab>
              <Lab label="Nationality"><input className="input" value={nationality} onChange={(e) => setNationality(e.target.value)} /></Lab>
              <Lab label="Email"><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Lab>
              <Lab label="Telephone"><input className="input" value={telephone} onChange={(e) => setTelephone(e.target.value)} /></Lab>
            </div>
          </Section>

          <Section title="3 · What did you see / measure / evaluate?" hint="Details of all the record guidelines you witnessed being followed.">
            <textarea className="input min-h-[140px]" value={witnessDetails} onChange={(e) => setWitnessDetails(e.target.value)} />
          </Section>

          <Section title="4 · Field of expertise" hint="Why you were chosen as a witness for this attempt.">
            <textarea className="input min-h-[80px]" value={expertise} onChange={(e) => setExpertise(e.target.value)} />
          </Section>

          <Section title="5 · Final measurement">
            <input className="input" placeholder="e.g. 72 hours 01 minute 08 seconds" value={finalMeasurement} onChange={(e) => setFinalMeasurement(e.target.value)} />
          </Section>

          <Section title="6 · Where did the record attempt take place?">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Lab label="Venue"><input className="input" value={venue} onChange={(e) => setVenue(e.target.value)} /></Lab>
              <Lab label="City / Town"><input className="input" value={cityTown} onChange={(e) => setCityTown(e.target.value)} /></Lab>
              <Lab label="Country"><input className="input" value={country} onChange={(e) => setCountry(e.target.value)} /></Lab>
            </div>
          </Section>

          <Section title="7 · When were you present at the record attempt?" hint="Include dates and times.">
            <textarea className="input min-h-[80px]" value={presentDates} onChange={(e) => setPresentDates(e.target.value)} />
          </Section>

          <Section title="8 · Sign & declare">
            <div className="space-y-2.5">
              {([
                ["rules", "All Guinness World Records rules and category guidelines were followed in their entirety."],
                ["measurements", "All measurements were taken using verified equipment and recorded accurately."],
                ["attendance", "I was personally in attendance for the entire attempt with no gaps in coverage."],
                ["timeline", "I have personally validated the timeline of events as recorded."],
              ] as const).map(([k, label]) => (
                <label key={k} className="flex items-start gap-3 p-3 rounded-lg border border-line hover:border-royal/40 cursor-pointer">
                  <input
                    type="checkbox" className="mt-1 accent-royal"
                    checked={acknowledged[k]} onChange={(e) => setAcknowledged({ ...acknowledged, [k]: e.target.checked })}
                  />
                  <div className="text-sm text-soft">{label}</div>
                </label>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Lab label="Date">
                <input className="input" type="date" value={completedDate} onChange={(e) => setCompletedDate(e.target.value)} />
              </Lab>
              <Lab label="Signature mode">
                <div className="inline-flex rounded-lg border border-line p-1 bg-canvas w-fit">
                  {([["draw", Pencil, "Draw"], ["type", Type, "Type"], ["upload", Upload, "Upload"]] as const).map(([k, Icon, l]) => (
                    <button key={k} type="button" onClick={() => setSigMode(k)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold ${sigMode === k ? "bg-white text-royal shadow-soft" : "text-muted hover:text-soft"}`}
                    >
                      <Icon className="h-3.5 w-3.5" /> {l}
                    </button>
                  ))}
                </div>
              </Lab>
            </div>

            <div className="mt-4">
              {sigMode === "draw" && (
                <div>
                  <div className="rounded-xl border border-line bg-canvas">
                    <canvas
                      ref={canvasRef} width={760} height={180}
                      className="w-full block touch-none rounded-xl bg-white"
                      onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-muted">
                    <span>Use your mouse, trackpad or pen to sign above.</span>
                    <button type="button" className="btn-ghost !py-1 !px-2" onClick={clearCanvas}>
                      <Eraser className="h-3.5 w-3.5" /> Clear
                    </button>
                  </div>
                </div>
              )}
              {sigMode === "type" && (
                <Lab label="Type your full legal name as your signature">
                  <input className="input font-serif italic text-lg" value={typedSig} onChange={(e) => setTypedSig(e.target.value)} />
                </Lab>
              )}
              {sigMode === "upload" && (
                <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-canvas p-8 cursor-pointer hover:border-royal/40">
                  <Upload className="h-5 w-5 text-royal" />
                  <div className="text-sm text-soft mt-2">{uploadedName ?? "Click or drag to upload a signature image"}</div>
                  <div className="text-[11px] text-muted mt-1">PNG or JPG, transparent background recommended</div>
                  <input type="file" className="hidden" accept="image/*" onChange={(e) => onUploadSig(e.target.files?.[0])} />
                </label>
              )}
            </div>
          </Section>
        </div>

        {/* sticky submit bar */}
        <div className="mt-8 -mx-5 lg:-mx-5 px-5 pt-5 border-t border-line">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ul className="text-[11px] text-muted flex flex-wrap gap-x-4 gap-y-1">
              <Hint ok={profileOk}>profile complete</Hint>
              <Hint ok={statementOk}>observations &amp; measurement</Hint>
              <Hint ok={allAck}>4 declarations confirmed</Hint>
              <Hint ok={hasSig}>signature captured</Hint>
            </ul>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownload} disabled={downloading}
                className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold border border-royal bg-white text-royal hover:bg-royal/[0.04] transition disabled:opacity-60"
              >
                <FileDown className="h-4 w-4" /> Preview PDF
              </button>
              <Button onClick={handleSubmit} disabled={!canSubmit || downloading}>
                {downloading ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating&hellip;</> : <><ShieldCheck className="h-4 w-4" /> Submit &amp; download official PDF</>}
              </Button>
            </div>
          </div>
          {downloadError && (
            <div className="mt-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs px-3 py-2">{downloadError}</div>
          )}
          <p className="text-[11px] text-muted mt-3 leading-relaxed">
            By submitting, you affirm under penalty of perjury that the above declarations are true and accurate.
            The official GWR Witness Statement Template (2022) will be filled with your responses, digitally
            signed and transmitted to the Guinness World Records adjudication team.
          </p>
        </div>
      </Card>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="text-sm font-bold text-soft">{title}</h4>
      {hint && <p className="text-[11px] text-muted mt-0.5">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Lab({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="text-[11px] uppercase tracking-wider text-muted">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Meta({ Icon, children }: { Icon: any; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-white/90">
      <Icon className="h-4 w-4 text-gold-300 shrink-0" />
      <span className="truncate">{children}</span>
    </div>
  );
}

function Hint({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={`inline-flex items-center gap-1.5 ${ok ? "text-emerald-700" : "text-muted"}`}>
      <CheckCircle2 className="h-3 w-3" /> {children}
    </li>
  );
}
