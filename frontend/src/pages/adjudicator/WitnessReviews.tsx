import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2, X, MessageSquareWarning, Search, Loader2, Mail, Pencil,
} from "lucide-react";
import { Badge, Card, PageHeader, Button } from "@/components/ui";
import { attemptsApi, witnessesApi, statementsApi } from "@/lib/api/resources";
import type { Attempt, Witness } from "@/lib/api/types";
import { formatDate, formatTime } from "@/lib/utils";

type StatementOut = Awaited<ReturnType<typeof statementsApi.list>>[number];

const FILTERS: Array<{ key: string; label: string }> = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending review" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "clarification_requested", label: "Clarification" },
];

function decisionLabel(w: Witness): string {
  if (w.decision === "approved") return "Approved";
  if (w.decision === "rejected") return "Rejected";
  if (w.decision === "clarification_requested") return "Clarification";
  if (w.status === "completed") return "Pending review";
  if (w.status === "invited") return "Invited";
  return "Pending";
}

function decisionTone(w: Witness): "green" | "red" | "amber" | "blue" | "default" {
  if (w.decision === "approved") return "green";
  if (w.decision === "rejected") return "red";
  if (w.decision === "clarification_requested") return "amber";
  if (w.status === "completed") return "blue";
  return "default";
}

export default function WitnessReviews() {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [witnesses, setWitnesses] = useState<Witness[]>([]);
  const [statements, setStatements] = useState<Record<string, StatementOut[]>>({}); // by attempt_id
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("pending");
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);
  const [editingDecisionFor, setEditingDecisionFor] = useState<string | null>(null);
  const [justSavedId, setJustSavedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await attemptsApi.list();
        if (cancelled) return;
        setAttempts(list);
        const allW: Witness[] = [];
        const allS: Record<string, StatementOut[]> = {};
        await Promise.all(list.map(async (a) => {
          try {
            const [w, s] = await Promise.all([
              witnessesApi.list(a.id),
              statementsApi.list(a.id).catch(() => []),
            ]);
            allW.push(...w);
            allS[a.id] = s;
          } catch { /* skip */ }
        }));
        if (!cancelled) {
          setWitnesses(allW);
          setStatements(allS);
          if (allW.length > 0 && !selectedId) {
            const firstPending = allW.find((w) => w.status === "completed" && !w.decision) ?? allW[0];
            setSelectedId(firstPending.id);
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load review queue");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    return witnesses.filter((w) => {
      if (filter === "pending" && !(w.status === "completed" && !w.decision)) return false;
      if (filter === "approved" && w.decision !== "approved") return false;
      if (filter === "rejected" && w.decision !== "rejected") return false;
      if (filter === "clarification_requested" && w.decision !== "clarification_requested") return false;
      if (q && !`${w.full_name} ${w.email} ${w.organisation ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [witnesses, filter, q]);

  const selected = useMemo(() => witnesses.find((w) => w.id === selectedId), [witnesses, selectedId]);
  const selectedAttempt = useMemo(() => attempts.find((a) => a.id === selected?.attempt_id), [attempts, selected]);
  const selectedStatement = useMemo(() => {
    if (!selected) return undefined;
    const list = statements[selected.attempt_id] ?? [];
    return list.find((s) => s.witness_id === selected.id);
  }, [statements, selected]);

  const review = async (decision: "approved" | "rejected" | "clarification_requested") => {
    if (!selected) return;
    setActingId(selected.id);
    try {
      const updated = await witnessesApi.review(selected.attempt_id, selected.id, { decision, note: note || undefined });
      setWitnesses((arr) => arr.map((w) => (w.id === updated.id ? updated : w)));
      setNote("");
      setEditingDecisionFor(null);
      setJustSavedId(updated.id);
      window.setTimeout(() => {
        setJustSavedId((cur) => (cur === updated.id ? null : cur));
      }, 4000);
    } catch (e: any) {
      setError(e?.message ?? "Review failed");
    } finally {
      setActingId(null);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Adjudicator · Review queue"
        title="Witness reviews"
        subtitle="Approve, reject or request clarification on each submitted witness statement."
        actions={
          witnesses.filter((w) => w.status === "completed" && !w.decision).length > 0 ? (
            <Badge tone="amber"><Mail className="h-3 w-3" /> {witnesses.filter((w) => w.status === "completed" && !w.decision).length} pending</Badge>
          ) : undefined
        }
      />

      {error && <div className="rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm px-3 py-2 mb-3">{error}</div>}

      {loading ? (
        <div className="text-sm text-muted inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Loading queue…</div>
      ) : (
        <div className="grid grid-cols-12 gap-5">
          {/* LEFT: list + filters */}
          <Card className="col-span-12 lg:col-span-4 !p-3">
            <div className="px-2 pt-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
                <input className="input pl-9" placeholder="Search witnesses…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    className={"chip " + (filter === f.key ? "!bg-royal/10 !text-royal !border-royal/30 font-semibold" : "")}
                    onClick={() => setFilter(f.key)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            <ul className="mt-3 divide-y divide-line max-h-[65vh] overflow-y-auto">
              {filtered.length === 0 && <li className="py-8 text-center text-sm text-muted">No witnesses match.</li>}
              {filtered.map((w) => (
                <li key={w.id}>
                  <button
                    onClick={() => setSelectedId(w.id)}
                    className={"w-full text-left px-3 py-3 hover:bg-canvas " + (selectedId === w.id ? "bg-canvas" : "")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-soft truncate">{w.full_name}</div>
                        <div className="text-[11px] text-muted truncate">{w.email}</div>
                      </div>
                      <Badge tone={decisionTone(w)}>{decisionLabel(w)}</Badge>
                    </div>
                    <div className="text-[11px] text-muted mt-1">{w.role}{w.completed_at ? ` · submitted ${formatDate(w.completed_at)}` : ""}</div>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          {/* RIGHT: detail + actions */}
          <Card className="col-span-12 lg:col-span-8">
            {!selected ? (
              <div className="py-10 text-center text-sm text-muted">Select a witness to review.</div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">{selectedAttempt?.record_title ?? "Attempt"}</div>
                    <h2 className="text-lg font-bold text-soft">{selected.full_name}</h2>
                    <div className="text-xs text-muted">{selected.email} · {selected.role}{selected.organisation ? ` · ${selected.organisation}` : ""}</div>
                  </div>
                  <Badge tone={decisionTone(selected)}>{decisionLabel(selected)}</Badge>
                </div>

                {selected.expertise && (
                  <div className="mt-3 text-sm text-soft"><span className="text-muted">Expertise:</span> {selected.expertise}</div>
                )}
                {selected.completed_at && (
                  <div className="mt-1 text-[11px] text-muted">Submitted {formatDate(selected.completed_at)} {formatTime(selected.completed_at)}</div>
                )}

                <div className="mt-5">
                  <h3 className="font-semibold text-sm text-soft mb-2">Statement</h3>
                  {!selectedStatement ? (
                    <div className="rounded-lg border border-line bg-canvas p-4 text-sm text-muted">
                      No statement submitted yet. The adjudicator can record a decision once the witness submits.
                    </div>
                  ) : (
                    <div className="rounded-lg border border-line p-4 space-y-2 text-sm">
                      {Object.entries(selectedStatement.fields ?? {}).map(([k, v]) => (
                        <div key={k} className="flex gap-2">
                          <div className="text-[11px] uppercase tracking-wider text-muted min-w-[100px] sm:min-w-[140px] shrink-0">{k}</div>
                          <div className="text-soft break-words">{typeof v === "string" ? v : Array.isArray(v) ? v.join(", ") : JSON.stringify(v)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {selected.decision_note && (
                  <div className="mt-4 rounded-lg bg-canvas border border-line p-3 text-sm text-soft">
                    <div className="text-[10px] uppercase tracking-wider text-muted font-semibold">Previous note</div>
                    {selected.decision_note}
                  </div>
                )}

                <div className="mt-6">
                  {justSavedId === selected.id && (
                    <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm px-3 py-2 inline-flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" /> Decision saved.
                    </div>
                  )}

                  {selected.decision && editingDecisionFor !== selected.id ? (
                    <div className="rounded-lg border border-line bg-canvas p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-sm">
                        <div className="text-[11px] uppercase tracking-wider text-muted font-semibold">Current decision</div>
                        <div className="mt-1 inline-flex items-center gap-2">
                          <Badge tone={decisionTone(selected)}>{decisionLabel(selected)}</Badge>
                          {selected.reviewed_at && (
                            <span className="text-[11px] text-muted">on {formatDate(selected.reviewed_at)} {formatTime(selected.reviewed_at)}</span>
                          )}
                        </div>
                      </div>
                      <Button variant="outline" onClick={() => { setEditingDecisionFor(selected.id); setNote(selected.decision_note ?? ""); }}>
                        <Pencil className="h-4 w-4" /> Change decision
                      </Button>
                    </div>
                  ) : (
                    <>
                      <label className="block">
                        <span className="text-[11px] uppercase tracking-wider text-muted">Decision note (optional)</span>
                        <textarea className="input mt-1 min-h-[80px]" placeholder="Add context for your decision…" value={note} onChange={(e) => setNote(e.target.value)} />
                      </label>
                      <div className="mt-3 flex flex-wrap gap-2 justify-end">
                        {selected.decision && (
                          <Button variant="ghost" onClick={() => { setEditingDecisionFor(null); setNote(""); }} disabled={actingId === selected.id}>
                            Cancel
                          </Button>
                        )}
                        <Button variant="outline" onClick={() => review("clarification_requested")} disabled={actingId === selected.id}>
                          <MessageSquareWarning className="h-4 w-4" /> Request clarification
                        </Button>
                        <Button variant="outline" onClick={() => review("rejected")} disabled={actingId === selected.id}>
                          <X className="h-4 w-4" /> Reject
                        </Button>
                        <Button variant="gold" onClick={() => review("approved")} disabled={actingId === selected.id}>
                          {actingId === selected.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Approve
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
