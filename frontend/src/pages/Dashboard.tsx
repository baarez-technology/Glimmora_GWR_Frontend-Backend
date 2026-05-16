import { useMemo } from "react";
import {
  Trophy,
  Sparkles,
  ShieldCheck,
  Users,
  ClipboardCheck,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Clock,
  Package,
  Mail,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, Button, Card, CardHeader, PageHeader, Progress } from "@/components/ui";
import {
  activityRows,
  restRows,
  aiAlerts,
} from "@/mock-data";
import { useSubmissionData } from "@/lib/api/useSubmissionData";
import { buildLogbook, computeSubmissionHealth, fmtAttemptDuration, fmtDuration } from "@/lib/gwr";
import { formatDate, formatTime } from "@/lib/utils";

const WORKFLOW = [
  { to: "/submissions/new", label: "Attempt Setup", icon: Trophy, status: "complete" },
  { to: "/cover-letter", label: "Cover Letter", icon: ClipboardCheck, status: "complete" },
  { to: "/witnesses", label: "Witnesses", icon: Users, status: "in-progress" },
  { to: "/logbook", label: "Activity Logbook", icon: Activity, status: "in-progress" },
  { to: "/evidence/upload", label: "Evidence", icon: ShieldCheck, status: "pending" },
  { to: "/package", label: "Submission Package", icon: Package, status: "pending" },
] as const;

export default function Dashboard() {
  const { attemptMeta, witnesses } = useSubmissionData();

  const witnessById = useMemo(() => {
    const m: Record<string, (typeof witnesses)[number]> = {};
    witnesses.forEach((w) => (m[w.id] = w));
    return m;
  }, [witnesses]);

  const log = useMemo(
    () => buildLogbook(activityRows, restRows, witnessById),
    [witnessById],
  );

  const health = useMemo(
    () =>
      computeSubmissionHealth({
        meta: attemptMeta,
        witnesses,
        activities: activityRows,
        rests: restRows,
        evidenceCount: 312,
        videoCount: 18,
        photoCount: 64,
        mediaArticlesCount: 7,
        timekeeperCount: 2,
        qualificationsUploaded: true,
        layoutDiagramUploaded: true,
      }),
    [attemptMeta, witnesses],
  );

  const witnessStats = {
    total: witnesses.length,
    completed: witnesses.filter((w) => w.status === "completed").length,
    pending: witnesses.filter((w) => w.status !== "completed").length,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Submission Operations"
        subtitle="The Glimmora GWR Submission OS automates every artefact required by Guinness World Records — from cover letter to final ZIP."
        actions={
          <>
            <Button variant="outline">
              <Sparkles className="h-4 w-4" /> AI assistant
            </Button>
            <Link to="/package">
              <Button variant="gold">
                Build submission <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </>
        }
      />

      {/* Attempt hero card */}
      <Card className="!p-0 overflow-hidden">
        <div className="bg-blue-shine text-white p-6 grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 items-center">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em] opacity-80 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-gold" /> Current Attempt
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-2 leading-tight">
              {attemptMeta.recordTitle}
            </h2>
            <div className="text-[12px] opacity-80 mt-1">
              {attemptMeta.applicationRef} · {attemptMeta.organisation}
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-4 text-[13px]">
              <Badge tone="gold">
                <Clock className="h-3 w-3" /> {fmtAttemptDuration(attemptMeta.startISO, attemptMeta.endISO)}
              </Badge>
              <span className="opacity-90">
                {formatDate(attemptMeta.startISO)} {formatTime(attemptMeta.startISO)} →{" "}
                {formatDate(attemptMeta.endISO)} {formatTime(attemptMeta.endISO)}
              </span>
              <span className="opacity-90">·  {attemptMeta.venue}, {attemptMeta.city}</span>
              <span className="opacity-90">· {attemptMeta.participantCount} participants</span>
            </div>
          </div>
          <div className="text-center lg:text-right">
            <div className="text-[10px] uppercase tracking-[0.24em] opacity-80">Submission Health</div>
            <div className="text-6xl font-extrabold leading-none mt-1">
              {health.score}
              <span className="text-2xl opacity-80">/100</span>
            </div>
            <div className="mt-2">
              <Badge tone={health.score >= 90 ? "green" : "gold"}>
                {health.score >= 90 ? "Submission-ready" : "Awaiting final evidence"}
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Workflow stepper */}
      <Card>
        <CardHeader title="Guinness submission workflow" subtitle="6 steps · automated end-to-end" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {WORKFLOW.map((step) => (
            <Link
              key={step.to}
              to={step.to}
              className="group rounded-xl border border-line p-4 hover:border-royal hover:shadow-soft transition"
            >
              <div className="flex items-center justify-between">
                <step.icon className="h-5 w-5 text-royal" />
                {step.status === "complete" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : step.status === "in-progress" ? (
                  <Clock className="h-4 w-4 text-amber-500" />
                ) : (
                  <span className="h-2.5 w-2.5 rounded-full bg-line" />
                )}
              </div>
              <div className="mt-3 font-semibold text-sm">{step.label}</div>
              <div className="text-[11px] text-muted capitalize">{step.status.replace("-", " ")}</div>
            </Link>
          ))}
        </div>
      </Card>

      {/* Three column: log summary, witness, alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader
            title="Activity log"
            subtitle="Auto-calculated per GWR Endurance Marathon rules"
            action={
              <Link to="/logbook">
                <Button variant="ghost">
                  Open <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            }
          />
          <div className="space-y-3">
            <div>
              <div className="text-[11px] text-muted uppercase tracking-wider mb-1 font-semibold">
                Total activity
              </div>
              <div className="text-2xl font-bold">{fmtDuration(log.totalActivityMin)}</div>
              <Progress value={Math.min(100, (log.totalActivityMin / (24 * 60)) * 100)} tone={log.totalActivityMin >= 24 * 60 ? "green" : "blue"} />
              <div className="text-[11px] text-muted mt-1">
                / 24h minimum (Rule 1)
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-line">
              <div>
                <div className="text-[11px] text-muted uppercase tracking-wider font-semibold">Rest taken</div>
                <div className="font-bold">{fmtDuration(log.totalRestTakenMin)}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted uppercase tracking-wider font-semibold">Balance</div>
                <div className={"font-bold " + (log.restBalanceMin > 0 ? "text-emerald-700" : "text-rose-600")}>
                  {log.restBalanceMin} min
                </div>
              </div>
            </div>
            {log.violations.length === 0 ? (
              <div className="flex items-center gap-2 text-emerald-700 text-[12px] pt-2 border-t border-line">
                <CheckCircle2 className="h-4 w-4" /> All GWR rest rules respected
              </div>
            ) : (
              <div className="flex items-center gap-2 text-rose-700 text-[12px] pt-2 border-t border-line">
                <AlertTriangle className="h-4 w-4" /> {log.violations.length} violation(s) — review logbook
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Witnesses"
            subtitle="Digital signing system"
            action={
              <Link to="/witnesses">
                <Button variant="ghost">
                  Open <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            }
          />
          <div className="text-center mb-3">
            <div className="text-4xl font-extrabold">{witnessStats.completed}<span className="text-2xl text-muted">/{witnessStats.total}</span></div>
            <div className="text-[12px] text-muted">witness statements signed</div>
          </div>
          <Progress value={(witnessStats.completed / witnessStats.total) * 100} tone="blue" />
          <div className="mt-4 space-y-2 max-h-[180px] overflow-auto pr-1">
            {witnesses.slice(0, 4).map((w) => (
              <div key={w.id} className="flex items-center gap-2 text-[12px]">
                <div className="h-7 w-7 rounded-full bg-royal text-white flex items-center justify-center text-[10px] font-bold shrink-0">
                  {w.firstName[0]}{w.lastName[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate text-soft">{w.firstName} {w.lastName}</div>
                  <div className="text-[10px] text-muted truncate">{w.role} · {w.status}</div>
                </div>
                {w.status === "completed" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Mail className="h-4 w-4 text-amber-500" />
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="AI Submission Co-pilot" subtitle="Active suggestions" action={<Sparkles className="h-4 w-4 text-gold" />} />
          <div className="space-y-3 max-h-[280px] overflow-auto pr-1">
            {aiAlerts.map((a) => {
              const tone =
                a.severity === "critical" || a.severity === "high"
                  ? "red"
                  : a.severity === "medium"
                    ? "amber"
                    : "blue";
              return (
                <div key={a.id} className="rounded-lg border border-line p-3">
                  <div className="flex items-start gap-2">
                    <Badge tone={tone}>{a.severity}</Badge>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[13px] truncate">{a.title}</div>
                      <div className="text-[11px] text-muted mt-0.5 line-clamp-2">{a.description}</div>
                      <div className="text-[11px] text-royal mt-1">→ {a.recommendation}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
