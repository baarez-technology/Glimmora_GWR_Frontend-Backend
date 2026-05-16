import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, MapPin, ArrowRight, Loader2 } from "lucide-react";
import { Badge, Card, PageHeader, Progress } from "@/components/ui";
import { attemptsApi, witnessesApi } from "@/lib/api/resources";
import type { Attempt, Witness } from "@/lib/api/types";
import { formatDate } from "@/lib/utils";

export default function AttemptReviews() {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [witnessesByAttempt, setWitnessesByAttempt] = useState<Record<string, Witness[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await attemptsApi.list();
        if (cancelled) return;
        setAttempts(list);
        const map: Record<string, Witness[]> = {};
        await Promise.all(list.map(async (a) => {
          try { map[a.id] = await witnessesApi.list(a.id); } catch { map[a.id] = []; }
        }));
        if (!cancelled) setWitnessesByAttempt(map);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load attempts");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <>
      <PageHeader eyebrow="Adjudicator" title="Attempt reviews" subtitle="All record attempts currently in your adjudication scope." />
      {error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm px-3 py-2 mb-3">{error}</div>}
      <Card>
        {loading ? (
          <div className="py-8 text-center text-sm text-muted inline-flex items-center gap-2 justify-center w-full"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : attempts.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted">No attempts in your scope yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-muted">
                  <th className="text-left py-2 px-3">Attempt</th>
                  <th className="text-left py-2 px-3">Status</th>
                  <th className="text-left py-2 px-3">Witnesses</th>
                  <th className="text-left py-2 px-3">Coverage</th>
                  <th className="text-left py-2 px-3">Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {attempts.map((a) => {
                  const ws = witnessesByAttempt[a.id] ?? [];
                  const approved = ws.filter((w) => w.decision === "approved").length;
                  const total = ws.length;
                  const coverage = total > 0 ? Math.round((approved / total) * 100) : 0;
                  return (
                    <tr key={a.id} className="hover:bg-canvas">
                      <td className="py-3 px-3">
                        <div className="font-semibold text-soft">{a.record_title}</div>
                        <div className="text-[11px] text-muted">{a.application_ref} {a.category && <>· {a.category}</>}</div>
                        {a.location && (
                          <div className="text-[11px] text-muted mt-1 inline-flex items-center gap-3">
                            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {a.location}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3"><Badge tone={a.status === "approved" ? "green" : a.status === "review" ? "blue" : "gold"}>{a.status}</Badge></td>
                      <td className="py-3 px-3 text-[12px] text-soft">{approved}/{total} approved</td>
                      <td className="py-3 px-3 w-[180px]">
                        <Progress value={coverage} tone="blue" />
                        <div className="text-[11px] text-muted mt-1">{coverage}%</div>
                      </td>
                      <td className="py-3 px-3 text-[12px] text-muted inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> {formatDate(a.created_at)}</td>
                      <td className="py-3 px-3 text-right">
                        <Link to={`/adjudicator/witnesses?attempt=${a.id}`} className="text-royal text-xs inline-flex items-center gap-1 hover:underline">
                          Review <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
