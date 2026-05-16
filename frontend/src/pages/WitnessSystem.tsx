import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mail,
  Link2,
  Send,
  CheckCircle2,
  Clock,
  AlertTriangle,
  UserPlus,
  Eye,
  Copy,
  Printer,
  Filter,
  Users,
  ShieldCheck,
  Timer,
  Loader2,
} from "lucide-react";
import { Badge, Button, Card, CardHeader, Input, PageHeader, Progress } from "@/components/ui";
import { attemptsApi, witnessesApi } from "@/lib/api/resources";
import type { Witness as ApiWitness, Attempt as ApiAttempt } from "@/lib/api/types";
import { formatDate, formatTime } from "@/lib/utils";

type WitnessRole = "specialist" | "independent" | "timekeeper";
type UiStatus = "pending" | "in-progress" | "completed" | "rejected";

const ROLE_LABEL: Record<WitnessRole, string> = {
  specialist: "Specialist Witness",
  independent: "Independent Witness",
  timekeeper: "Timekeeper",
};

const STATUS_TONE: Record<UiStatus, "green" | "amber" | "blue" | "red"> = {
  completed: "green",
  "in-progress": "blue",
  pending: "amber",
  rejected: "red",
};

const STATUS_ICON: Record<UiStatus, React.ComponentType<{ className?: string }>> = {
  completed: CheckCircle2,
  "in-progress": Clock,
  pending: Mail,
  rejected: AlertTriangle,
};

function backendStatusToUi(s: string): UiStatus {
  if (s === "invited") return "in-progress";
  if (s === "completed") return "completed";
  if (s === "rejected") return "rejected";
  return "pending";
}

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0] || "", lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function rolePill(role: WitnessRole) {
  const map: Record<WitnessRole, { tone: "blue" | "gold" | "default"; Icon: React.ComponentType<{ className?: string }> }> = {
    specialist: { tone: "blue", Icon: ShieldCheck },
    independent: { tone: "default", Icon: Users },
    timekeeper: { tone: "gold", Icon: Timer },
  };
  const entry = map[role] ?? map.independent;
  const { tone, Icon } = entry;
  return (
    <Badge tone={tone}>
      <Icon className="h-3 w-3" /> {ROLE_LABEL[role] ?? "Witness"}
    </Badge>
  );
}

export default function WitnessSystem() {
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState<ApiAttempt[]>([]);
  const [attemptId, setAttemptId] = useState<string>("");
  const [list, setList] = useState<ApiWitness[]>([]);
  const [filter, setFilter] = useState<"all" | UiStatus>("all");
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    firstName: "",
    lastName: "",
    email: "",
    organisation: "",
    expertise: "",
    role: "independent" as WitnessRole,
  });
  const [linkCopied, setLinkCopied] = useState<string | null>(null);
  const [pendingInviteId, setPendingInviteId] = useState<string | null>(null);

  const selectedAttempt = useMemo(
    () => attempts.find((a) => a.id === attemptId),
    [attempts, attemptId]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = await attemptsApi.list();
        if (cancelled) return;
        setAttempts(all);
        if (all.length > 0 && !attemptId) setAttemptId(all[0].id);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load attempts");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!attemptId) return;
    let cancelled = false;
    (async () => {
      try {
        const ws = await witnessesApi.list(attemptId);
        if (!cancelled) setList(ws);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load witnesses");
      }
    })();
    return () => { cancelled = true; };
  }, [attemptId]);

  const stats = useMemo(() => {
    const ui = list.map((w) => backendStatusToUi(w.status));
    const by = (s: UiStatus) => ui.filter((x) => x === s).length;
    return {
      total: list.length,
      completed: by("completed"),
      pending: by("pending"),
      inProgress: by("in-progress"),
      specialists: list.filter((w) => w.role === "specialist" && w.status === "completed").length,
      timekeepers: list.filter((w) => w.role === "timekeeper" && w.status === "completed").length,
    };
  }, [list]);

  const filtered = filter === "all" ? list : list.filter((w) => backendStatusToUi(w.status) === filter);

  const sendInvite = async (witnessId: string) => {
    if (!attemptId) return;
    setPendingInviteId(witnessId);
    setError(null);
    try {
      const updated = await witnessesApi.invite(attemptId, witnessId);
      setList((arr) => arr.map((w) => (w.id === witnessId ? updated : w)));
    } catch (e: any) {
      setError(e?.message ?? "Failed to send invitation");
    } finally {
      setPendingInviteId(null);
    }
  };

  const copyLink = (token: string | null) => {
    if (!token) return;
    const url = `${window.location.origin}/witness/sign/${token}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setLinkCopied(token);
    setTimeout(() => setLinkCopied(null), 1600);
  };

  const addWitness = async () => {
    if (!attemptId) {
      setError("Select an attempt first.");
      return;
    }
    if (!draft.firstName || !draft.lastName || !draft.email) return;
    setBusy(true);
    setError(null);
    try {
      const created = await witnessesApi.create(attemptId, {
        role: draft.role,
        full_name: `${draft.firstName} ${draft.lastName}`.trim(),
        email: draft.email,
        organisation: draft.organisation || undefined,
        expertise: draft.expertise || undefined,
        send_email: false, // only generate link; "Send invitation" emails it
      });
      setList((arr) => [...arr, created]);
      setDraft({ firstName: "", lastName: "", email: "", organisation: "", expertise: "", role: "independent" });
      setAdding(false);
    } catch (e: any) {
      setError(e?.message ?? "Failed to create witness");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Digital Witness System"
        subtitle="Invite, track and sign witness statements for the Guinness World Records attempt — entirely online, with auto-generated PDFs."
        actions={
          <Button variant="gold" onClick={() => setAdding(true)} disabled={!attemptId}>
            <UserPlus className="h-4 w-4" /> Add witness
          </Button>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm px-3 py-2">{error}</div>
      )}

      {loading ? (
        <div className="text-sm text-muted flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : attempts.length === 0 ? (
        <Card className="!p-8 text-center text-sm text-muted">
          You don't have any attempts yet. Create one first to invite witnesses.
        </Card>
      ) : (
        <>
          {attempts.length > 1 && (
            <div className="flex items-center gap-2">
              <label className="text-[11px] uppercase tracking-wider text-muted font-semibold">Attempt</label>
              <select
                className="input max-w-md"
                value={attemptId}
                onChange={(e) => setAttemptId(e.target.value)}
              >
                {attempts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.record_title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="!p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted font-semibold">Total Witnesses</div>
              <div className="text-3xl font-bold mt-1">{stats.total}</div>
              <div className="text-[11px] text-muted mt-1">{stats.completed} signed · {stats.pending} pending</div>
            </Card>
            <Card className="!p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted font-semibold">Specialist Coverage</div>
              <div className="text-3xl font-bold mt-1">{stats.specialists}<span className="text-base text-muted">/2</span></div>
              <Progress value={(stats.specialists / 2) * 100} tone={stats.specialists >= 2 ? "green" : "gold"} />
            </Card>
            <Card className="!p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted font-semibold">Timekeepers</div>
              <div className="text-3xl font-bold mt-1">{stats.timekeepers}<span className="text-base text-muted">/2</span></div>
              <Progress value={(stats.timekeepers / 2) * 100} tone={stats.timekeepers >= 2 ? "green" : "gold"} />
            </Card>
            <Card className="!p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted font-semibold">In progress</div>
              <div className="text-3xl font-bold mt-1 text-royal">{stats.inProgress}</div>
              <div className="text-[11px] text-muted mt-1">awaiting signature</div>
            </Card>
            <Card className="!p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted font-semibold">Auto-reminders</div>
              <div className="text-3xl font-bold mt-1">Daily</div>
              <div className="text-[11px] text-muted mt-1">via Brevo email</div>
            </Card>
          </div>

          {/* Filter strip */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted" />
            {(["all", "pending", "in-progress", "completed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={
                  "chip " +
                  (filter === f ? "!bg-royal/10 !text-royal !border-royal/30 font-semibold" : "")
                }
              >
                {f === "all" ? "All" : f.replace("-", " ")}
              </button>
            ))}
          </div>

          {/* Witness cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filtered.length === 0 && (
              <Card className="!p-8 text-center text-sm text-muted lg:col-span-2">
                No witnesses yet. Click "Add witness" to invite one.
              </Card>
            )}
            {filtered.map((w) => {
              const uiStatus = backendStatusToUi(w.status);
              const Icon = STATUS_ICON[uiStatus];
              const role: WitnessRole =
                w.role === "specialist" || w.role === "independent" || w.role === "timekeeper"
                  ? w.role
                  : "independent";
              const { firstName, lastName } = splitName(w.full_name);
              const inviteUrl = w.token ? `${window.location.origin}/witness/sign/${w.token}` : "";
              return (
                <Card key={w.id} className="!p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-full bg-royal text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {(firstName[0] || "").toUpperCase()}
                        {(lastName[0] || "").toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{w.full_name}</div>
                        <div className="text-[12px] text-muted truncate">{w.organisation || w.email}</div>
                        <div className="text-[11px] text-muted truncate">{w.expertise}</div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {rolePill(role)}
                      <Badge tone={STATUS_TONE[uiStatus]}>
                        <Icon className="h-3 w-3" /> {uiStatus.replace("-", " ")}
                      </Badge>
                    </div>
                  </div>

                  {/* Shareable link */}
                  {inviteUrl && (
                    <div className="mt-4 rounded-lg bg-canvas border border-line p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[10px] uppercase tracking-wider text-muted font-semibold flex items-center gap-1">
                            <Link2 className="h-3 w-3" /> Shareable signing link
                          </div>
                          <div className="text-[12px] font-mono truncate text-soft mt-0.5">{inviteUrl}</div>
                        </div>
                        <button
                          onClick={() => copyLink(w.token)}
                          className="btn-ghost !py-1.5 !px-2"
                          title="Copy link"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {linkCopied === w.token && (
                        <div className="text-[11px] text-emerald-600 mt-1">Copied to clipboard</div>
                      )}
                    </div>
                  )}

                  {w.completed_at && (
                    <div className="text-[11px] text-emerald-700 mt-1">
                      Signed {formatDate(w.completed_at)} {formatTime(w.completed_at)}
                    </div>
                  )}
                  {w.invited_at && uiStatus !== "completed" && (
                    <div className="text-[11px] text-muted mt-1">
                      Invited {formatDate(w.invited_at)} {formatTime(w.invited_at)}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {uiStatus === "pending" && (
                      <Button variant="primary" onClick={() => sendInvite(w.id)} disabled={pendingInviteId === w.id}>
                        {pendingInviteId === w.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send invitation
                      </Button>
                    )}
                    {uiStatus === "in-progress" && (
                      <Button variant="outline" onClick={() => sendInvite(w.id)} disabled={pendingInviteId === w.id}>
                        {pendingInviteId === w.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Resend
                      </Button>
                    )}
                    {w.token && (
                      <Button variant="outline" onClick={() => navigate(`/witness/sign/${w.token}`)}>
                        <Eye className="h-4 w-4" /> Preview form
                      </Button>
                    )}
                    {uiStatus === "completed" && (
                      <Button variant="ghost">
                        <Printer className="h-4 w-4" /> Export PDF
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Add witness modal */}
      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-soft/40 backdrop-blur-sm p-4">
          <Card className="w-full max-w-lg">
            <CardHeader title="Invite a witness" subtitle={`for ${selectedAttempt?.record_title ?? ""}`} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input placeholder="First name" value={draft.firstName} onChange={(e) => setDraft({ ...draft, firstName: e.target.value })} />
              <Input placeholder="Last name" value={draft.lastName} onChange={(e) => setDraft({ ...draft, lastName: e.target.value })} />
              <Input className="sm:col-span-2" type="email" placeholder="Email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} />
              <Input className="sm:col-span-2" placeholder="Organisation" value={draft.organisation} onChange={(e) => setDraft({ ...draft, organisation: e.target.value })} />
              <Input className="sm:col-span-2" placeholder="Field of expertise" value={draft.expertise} onChange={(e) => setDraft({ ...draft, expertise: e.target.value })} />
              <select
                className="input sm:col-span-2"
                value={draft.role}
                onChange={(e) => setDraft({ ...draft, role: e.target.value as WitnessRole })}
              >
                <option value="independent">Independent witness</option>
                <option value="specialist">Specialist witness (AI/ML)</option>
                <option value="timekeeper">Timekeeper</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <Button variant="ghost" onClick={() => setAdding(false)} disabled={busy}>Cancel</Button>
              <Button variant="gold" onClick={addWitness} disabled={busy || !draft.firstName || !draft.lastName || !draft.email}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Invite &amp; generate link
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
