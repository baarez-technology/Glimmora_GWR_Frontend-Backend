import { useMemo, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  Users, Sparkles, AlertTriangle, CheckCircle2, Trash2, ChevronRight, Star,
  Wand2, Mail, Download, CheckSquare, Square, Loader2,
} from "lucide-react";
import { Card, PageHeader, Badge, Button } from "@/components/ui";
import {
  adminEventsApi, adminAdjudicatorsApi, adminAssignmentsApi,
  type AdminAssignment,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api";
import { formatDate, relativeTime } from "@/lib/utils";
import { useToast } from "@/components/Toaster";
import ConfirmDialog from "@/components/ConfirmDialog";

const STATUS_OPTIONS: AdminAssignment["status"][] = [
  "Assigned", "Travelling", "On-site", "Completed", "Cancelled",
];

function downloadCSV(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) =>
      r.map((cell) => {
        const s = String(cell ?? "");
        if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
        return s;
      }).join(",")
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function Assignments() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const routerLocation = useLocation();

  const eventsQ = useQuery({ queryKey: ["admin", "events"], queryFn: () => adminEventsApi.list() });
  const adjQ = useQuery({ queryKey: ["admin", "adjudicators"], queryFn: () => adminAdjudicatorsApi.list() });
  const asnQ = useQuery({ queryKey: ["admin", "assignments"], queryFn: () => adminAssignmentsApi.list() });

  const events = eventsQ.data ?? [];
  const adjudicators = adjQ.data ?? [];
  const assignments = asnQ.data ?? [];

  const initial = (routerLocation.state as { eventId?: string } | null)?.eventId ?? events[0]?.id ?? "";
  const [eventId, setEventId] = useState<string>(initial);
  const [role, setRole] = useState<AdminAssignment["role"]>("Adjudicator");
  const [confirmUnassign, setConfirmUnassign] = useState<{ id: string; name: string } | null>(null);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());

  // Pick first event once loaded
  useEffect(() => {
    if (!eventId && events.length > 0) setEventId(events[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.length]);

  useEffect(() => {
    const fromState = (routerLocation.state as { eventId?: string } | null)?.eventId;
    if (fromState) setEventId(fromState);
  }, [routerLocation.state]);

  useEffect(() => { setBulkSelected(new Set()); }, [eventId]);

  const assign = useMutation({
    mutationFn: (body: { event_id: string; adjudicator_id: string; role: AdminAssignment["role"]; note?: string }) =>
      adminAssignmentsApi.create(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "assignments"] }),
  });
  const unassign = useMutation({
    mutationFn: (id: string) => adminAssignmentsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "assignments"] }),
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AdminAssignment["status"] }) =>
      adminAssignmentsApi.update(id, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "assignments"] }),
  });

  if (eventsQ.isLoading || adjQ.isLoading) {
    return (
      <Card className="py-16 flex items-center justify-center gap-2 text-muted mt-10 max-w-md mx-auto">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading admin data…
      </Card>
    );
  }
  if (events.length === 0) {
    return (
      <Card className="max-w-md mx-auto text-center py-12 mt-10">
        <div className="font-semibold text-soft">No events yet</div>
        <p className="text-sm text-muted mt-1">Create one in Events first.</p>
      </Card>
    );
  }
  const event = events.find((e) => e.id === eventId) ?? events[0];
  const eventAssignments = assignments.filter((a) => a.event_id === event.id);
  const assignedIds = new Set(eventAssignments.map((a) => a.adjudicator_id));

  const suggestions = useMemo(() => {
    return adjudicators
      .filter((a) => !assignedIds.has(a.id) && a.status === "Active")
      .map((a) => {
        const specialtyMatch = a.specialties.includes(event.category);
        const matchScore = (specialtyMatch ? 3 : 0) + a.rating;
        const conflicting = assignments.find((x) => {
          if (x.adjudicator_id !== a.id) return false;
          const other = events.find((e) => e.id === x.event_id);
          if (!other || !other.start_iso || !other.end_iso || !event.start_iso || !event.end_iso) return false;
          return (
            new Date(other.start_iso) <= new Date(event.end_iso) &&
            new Date(other.end_iso) >= new Date(event.start_iso)
          );
        });
        return { adj: a, matchScore, specialtyMatch, conflict: !!conflicting, conflictWith: conflicting?.event_id };
      })
      .sort((a, b) => b.matchScore - a.matchScore);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id, assignments, adjudicators, events]);

  const understaffed = eventAssignments.length < event.required_adjudicators;
  const missingCount = Math.max(0, event.required_adjudicators - eventAssignments.length);

  function doAssign(adjudicator_id: string, asRole: AdminAssignment["role"], silent = false) {
    const adj = adjudicators.find((x) => x.id === adjudicator_id);
    assign.mutate(
      { event_id: event.id, adjudicator_id, role: asRole },
      {
        onSuccess: () => {
          if (!silent && adj) {
            toast({
              title: `Assigned ${adj.name}`,
              description: `${asRole} on ${event.title.slice(0, 40)}${event.title.length > 40 ? "…" : ""}`,
              tone: "success",
            });
          }
        },
        onError: (e) => {
          toast({
            title: `Couldn't assign${adj ? ` ${adj.name}` : ""}`,
            description: errMsg(e),
            tone: "danger",
          });
        },
      }
    );
  }

  async function autoAssign() {
    const need = Math.max(0, event.required_adjudicators - eventAssignments.length);
    if (need === 0) {
      toast({ title: "Already fully staffed", tone: "info" });
      return;
    }
    const picks = suggestions.filter((s) => !s.conflict).slice(0, need);
    if (picks.length === 0) {
      toast({
        title: "No conflict-free candidates",
        description: "All remaining adjudicators have a scheduling overlap.",
        tone: "warning",
      });
      return;
    }
    let i = 0;
    for (const p of picks) {
      const asRole: AdminAssignment["role"] =
        eventAssignments.length === 0 && i === 0 ? "Lead Adjudicator" : "Adjudicator";
      doAssign(p.adj.id, asRole, true);
      i++;
    }
    toast({
      title: `Auto-assigning ${picks.length} adjudicator${picks.length > 1 ? "s" : ""}`,
      description: picks.map((p) => p.adj.name).join(" · "),
      tone: "success",
    });
  }

  function assignSelected() {
    if (bulkSelected.size === 0) return;
    const ids = Array.from(bulkSelected);
    ids.forEach((id, i) => {
      const isFirst = eventAssignments.length === 0 && i === 0;
      doAssign(id, isFirst ? "Lead Adjudicator" : role, true);
    });
    toast({
      title: `Assigning ${ids.length} adjudicator${ids.length > 1 ? "s" : ""}`,
      tone: "success",
    });
    setBulkSelected(new Set());
  }

  function toggleBulk(id: string) {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleConfirmUnassign() {
    if (!confirmUnassign) return;
    unassign.mutate(confirmUnassign.id, {
      onSuccess: () => {
        toast({ title: `Removed ${confirmUnassign.name}`, tone: "info" });
        setConfirmUnassign(null);
      },
      onError: (e) => toast({ title: "Couldn't unassign", description: errMsg(e), tone: "danger" }),
    });
  }

  function exportEventCsv() {
    downloadCSV(`assignments_${event.id}.csv`, [
      ["Assignment ID", "Adjudicator", "Email", "Role", "Status", "Assigned at"],
      ...eventAssignments.map((a) => {
        const adj = adjudicators.find((x) => x.id === a.adjudicator_id);
        return [a.id, adj?.name ?? a.adjudicator_id, adj?.email ?? "", a.role, a.status, a.assigned_at];
      }),
    ]);
    toast({ title: "CSV exported", description: `${eventAssignments.length} rows`, tone: "success" });
  }

  function exportAllCsv() {
    downloadCSV("assignments_all.csv", [
      ["Assignment ID", "Event ID", "Event Title", "Adjudicator", "Role", "Status", "Assigned at"],
      ...assignments.map((a) => {
        const adj = adjudicators.find((x) => x.id === a.adjudicator_id);
        const ev = events.find((e) => e.id === a.event_id);
        return [a.id, a.event_id, ev?.title ?? "", adj?.name ?? a.adjudicator_id, a.role, a.status, a.assigned_at];
      }),
    ]);
    toast({ title: "Global CSV exported", description: `${assignments.length} rows`, tone: "success" });
  }

  return (
    <>
      <PageHeader
        eyebrow="Admin · Assignments"
        title="Assign adjudicators to events"
        subtitle="Live from the backend. Match specialty + availability, avoid conflicts, confirm coverage."
        actions={
          <>
            <Button variant="outline" onClick={exportAllCsv}><Download className="h-4 w-4" /> Export all</Button>
            <Button variant="gold" onClick={autoAssign} disabled={!understaffed}>
              <Wand2 className="h-4 w-4" />
              {understaffed ? `Auto-assign best fit (${missingCount})` : "Fully staffed"}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card>
          <div className="text-[10px] uppercase tracking-wider text-muted mb-2">Event</div>
          <select value={event.id} onChange={(e) => setEventId(e.target.value)} className="input text-sm w-full">
            {events.map((e) => (
              <option key={e.id} value={e.id}>{e.id} · {e.title.slice(0, 38)}</option>
            ))}
          </select>

          <div className="mt-4 rounded-xl border border-line p-4 bg-canvas/40">
            <div className="text-[10px] uppercase tracking-wider text-royal font-bold">{event.id}</div>
            <div className="font-semibold text-soft mt-1 leading-tight">{event.title}</div>
            <div className="text-[11px] text-muted mt-1">
              {event.city ?? "—"}, {event.country ?? "—"}
              {event.start_iso && <> · {formatDate(event.start_iso)}{event.end_iso ? ` → ${formatDate(event.end_iso)}` : ""}</>}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="default">{event.category}</Badge>
              <Badge tone="blue">{event.required_adjudicators} required</Badge>
              <Badge tone={understaffed ? "amber" : "green"}>{eventAssignments.length} assigned</Badge>
            </div>
          </div>

          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-wider text-muted mb-2">Assign as</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {(["Lead Adjudicator", "Adjudicator", "Observer"] as const).map((r) => (
                <button key={r} onClick={() => setRole(r)} className={`rounded-lg border px-2.5 py-2 text-[11px] font-semibold transition ${role === r ? "border-royal bg-royal/[0.06] text-royal" : "border-line text-soft hover:border-royal/40"}`}>{r}</button>
              ))}
            </div>
          </div>

          {understaffed ? (
            <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[12px] px-3 py-2 inline-flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" /> Coverage gap — {missingCount} more needed.
            </div>
          ) : (
            <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[12px] px-3 py-2 inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> Event is fully staffed.
            </div>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
            <div>
              <h3 className="font-semibold text-soft inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-gold" /> Suggested adjudicators
              </h3>
              <p className="text-xs text-muted">Ranked by specialty match and rating. Scheduling conflicts are flagged.</p>
            </div>
            <div className="flex items-center gap-2">
              {bulkSelected.size > 0 && (
                <Button onClick={assignSelected}><CheckSquare className="h-4 w-4" /> Assign selected ({bulkSelected.size})</Button>
              )}
              <Badge tone="default">{suggestions.length} candidates</Badge>
            </div>
          </div>

          {suggestions.length === 0 ? (
            <EmptyState title="Everyone is already assigned" detail="Every active adjudicator on this event has been added." />
          ) : (
            <ul className="divide-y divide-line">
              {suggestions.slice(0, 10).map(({ adj, matchScore, specialtyMatch, conflict, conflictWith }) => {
                const isSelected = bulkSelected.has(adj.id);
                return (
                  <li key={adj.id} className="py-3 flex items-center justify-between gap-3 group">
                    <div className="flex items-center gap-3 min-w-0">
                      <button onClick={() => toggleBulk(adj.id)} className="shrink-0 text-muted hover:text-royal" aria-label={isSelected ? "Unselect" : "Select for bulk assign"}>
                        {isSelected ? <CheckSquare className="h-4 w-4 text-royal" /> : <Square className="h-4 w-4" />}
                      </button>
                      <div className="h-10 w-10 rounded-full bg-royal/10 text-royal flex items-center justify-center text-[11px] font-bold shrink-0">
                        {adj.initials}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-soft truncate">{adj.name}</div>
                        <div className="text-[11px] text-muted">{adj.region} · {adj.specialties.slice(0, 2).join(", ")}</div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {specialtyMatch && <Badge tone="green">Specialty match</Badge>}
                          <Badge tone="gold"><Star className="h-3 w-3 fill-current" /> {adj.rating}</Badge>
                          {conflict && <Badge tone="red"><AlertTriangle className="h-3 w-3" /> Conflicts with {conflictWith}</Badge>}
                          <span className="text-[10px] text-muted">score {matchScore.toFixed(1)}</span>
                        </div>
                      </div>
                    </div>
                    <Button variant={conflict ? "outline" : "primary"} onClick={() => doAssign(adj.id, role)} title={conflict ? "Will create a scheduling overlap" : "Assign to event"}>
                      Assign <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="font-semibold text-soft inline-flex items-center gap-2">
            <Users className="h-4 w-4 text-royal" /> Current assignments — {event.id}
          </h3>
          <div className="flex items-center gap-2">
            {eventAssignments.length > 0 && (
              <Button variant="outline" onClick={exportEventCsv}><Download className="h-3.5 w-3.5" /> Export</Button>
            )}
            <Badge tone={understaffed ? "amber" : "green"}>{eventAssignments.length} / {event.required_adjudicators}</Badge>
          </div>
        </div>

        {eventAssignments.length === 0 ? (
          <EmptyState
            title="No adjudicators assigned yet"
            detail={`Click "Auto-assign best fit" to fill all ${event.required_adjudicators} required slot${event.required_adjudicators > 1 ? "s" : ""}, or pick from the suggestions above.`}
          />
        ) : (
          <ul className="divide-y divide-line">
            <AnimatePresence initial={false}>
              {eventAssignments.map((a) => {
                const adj = adjudicators.find((x) => x.id === a.adjudicator_id);
                if (!adj) return null;
                return (
                  <motion.li
                    key={a.id} layout
                    initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 20, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="py-3 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-full bg-royal/10 text-royal flex items-center justify-center text-[11px] font-bold">{adj.initials}</div>
                      <div className="min-w-0">
                        <div className="font-semibold text-soft truncate">{adj.name}</div>
                        <div className="text-[11px] text-muted">{a.role} · assigned {relativeTime(a.assigned_at)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toast({ title: `Email drafted to ${adj.name}`, description: `Briefing pack for ${event.id} queued.`, tone: "success" })}
                        className="btn-ghost !px-2" title="Send briefing email"
                      >
                        <Mail className="h-3.5 w-3.5" />
                      </button>
                      <select
                        value={a.status}
                        onChange={(e) => {
                          const next = e.target.value as AdminAssignment["status"];
                          setStatus.mutate({ id: a.id, status: next }, {
                            onSuccess: () => toast({ title: `${adj.name} → ${next}`, tone: next === "Cancelled" ? "warning" : "info" }),
                            onError: (err) => toast({ title: "Couldn't update status", description: errMsg(err), tone: "danger" }),
                          });
                        }}
                        className="input py-1 text-xs"
                      >
                        {STATUS_OPTIONS.map((s) => <option key={s}>{s}</option>)}
                      </select>
                      <button onClick={() => setConfirmUnassign({ id: a.id, name: adj.name })} className="btn-ghost !px-2" title="Unassign">
                        <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                      </button>
                    </div>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={!!confirmUnassign}
        title={`Unassign ${confirmUnassign?.name}?`}
        description="They will be removed from this event's roster. You can re-assign them later from the suggestions list."
        confirmLabel="Unassign"
        tone="danger"
        onConfirm={handleConfirmUnassign}
        onCancel={() => setConfirmUnassign(null)}
      />
    </>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line p-8 text-center">
      <div className="text-sm font-semibold text-soft">{title}</div>
      <div className="text-[12px] text-muted mt-1 max-w-md mx-auto">{detail}</div>
    </div>
  );
}

function errMsg(e: unknown): string {
  return e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Unknown error";
}
