import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Users, FileCheck2, AlertTriangle, ShieldCheck, ArrowRight, Activity, Loader2 } from "lucide-react";
import { Card, PageHeader, Badge, Progress } from "@/components/ui";
import StatCard from "@/components/StatCard";
import { attemptsApi, witnessesApi } from "@/lib/api/resources";
import type { Attempt, Witness } from "@/lib/api/types";
import { formatDate } from "@/lib/utils";
import { useAppSelector } from "@/redux/store";

export default function AdjudicatorDashboard() {
  const user = useAppSelector((s) => s.auth.user);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [witnesses, setWitnesses] = useState<Witness[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await attemptsApi.list();
        if (cancelled) return;
        setAttempts(list);
        const all: Witness[] = [];
        for (const a of list) {
          try { all.push(...(await witnessesApi.list(a.id))); } catch { /* skip */ }
        }
        if (!cancelled) setWitnesses(all);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => {
    const pending = witnesses.filter((w) => !w.decision && w.status === "completed").length;
    const approved = witnesses.filter((w) => w.decision === "approved").length;
    const rejected = witnesses.filter((w) => w.decision === "rejected").length;
    const clarification = witnesses.filter((w) => w.decision === "clarification_requested").length;
    return { pending, approved, rejected, clarification };
  }, [witnesses]);

  const recent = useMemo(
    () => [...witnesses].sort((a, b) => (b.completed_at ?? b.created_at).localeCompare(a.completed_at ?? a.created_at)).slice(0, 6),
    [witnesses]
  );

  return (
    <>
      <PageHeader
        eyebrow="Adjudicator Workspace"
        title={`Good day, ${user?.name?.split(" ")[0] ?? ""}.`}
        subtitle="Operational overview of your queue and review activity."
        actions={
          <Link to="/adjudicator/witnesses" className="btn-primary">
            <Users className="h-4 w-4" /> Open review queue
          </Link>
        }
      />

      {error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm px-3 py-2 mb-3">{error}</div>}
      {loading ? (
        <div className="text-sm text-muted inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Pending review" value={stats.pending} Icon={FileCheck2} tone="blue" />
            <StatCard label="Active attempts" value={attempts.length} Icon={Activity} tone="gold" />
            <StatCard label="Rejected" value={stats.rejected} Icon={AlertTriangle} tone="red" />
            <StatCard label="Approved witnesses" value={stats.approved} Icon={ShieldCheck} tone="green" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-6">
            <Card className="lg:col-span-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-soft">Recent witness submissions</h3>
                <Link to="/adjudicator/witnesses" className="text-xs text-royal hover:underline inline-flex items-center gap-1">
                  Open queue <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              {recent.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted">No witness submissions yet.</div>
              ) : (
                <ul className="space-y-3">
                  {recent.map((w) => (
                    <li key={w.id} className="text-sm flex items-center justify-between border-b border-line/60 pb-2 last:border-0">
                      <div className="min-w-0">
                        <div className="font-semibold text-soft truncate">{w.full_name}</div>
                        <div className="text-[11px] text-muted truncate">{w.email} · {w.role}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge tone={w.decision === "approved" ? "green" : w.decision === "rejected" ? "red" : w.status === "completed" ? "blue" : "amber"}>
                          {w.decision ?? w.status}
                        </Badge>
                        <div className="text-[11px] text-muted mt-1">{w.completed_at ? formatDate(w.completed_at) : "—"}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <h3 className="font-semibold text-soft">My queue health</h3>
              <ul className="mt-4 space-y-3 text-sm">
                <Bar label="Pending review" value={stats.pending} max={Math.max(20, stats.pending)} tone="blue" />
                <Bar label="Clarification requested" value={stats.clarification} max={Math.max(10, stats.clarification)} tone="gold" />
                <Bar label="Approved" value={stats.approved} max={Math.max(20, stats.approved)} tone="green" />
                <Bar label="Rejected" value={stats.rejected} max={Math.max(10, stats.rejected)} tone="red" />
              </ul>
            </Card>
          </div>
        </>
      )}
    </>
  );
}

function Bar({ label, value, max, tone }: { label: string; value: number; max: number; tone: "blue"|"gold"|"green"|"red" }) {
  return (
    <li>
      <div className="flex items-center justify-between text-[12px] mb-1.5">
        <span className="text-soft">{label}</span>
        <span className="text-muted">{value}</span>
      </div>
      <Progress value={max === 0 ? 0 : (value / max) * 100} tone={tone} />
    </li>
  );
}
