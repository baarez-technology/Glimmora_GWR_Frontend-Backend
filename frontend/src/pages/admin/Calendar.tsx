import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, CalendarRange, AlertTriangle, Loader2 } from "lucide-react";
import { Card, PageHeader, Badge, Button } from "@/components/ui";
import { adminEventsApi, adminAdjudicatorsApi, adminAssignmentsApi, type AdminEvent, type AdminAssignment } from "@/lib/api/admin";
import { formatDate } from "@/lib/utils";

const DAY_MS = 86_400_000;
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };

export default function CalendarPage() {
  const adjQ = useQuery({ queryKey: ["admin", "adjudicators"], queryFn: () => adminAdjudicatorsApi.list() });
  const eventsQ = useQuery({ queryKey: ["admin", "events"], queryFn: () => adminEventsApi.list() });
  const asnQ = useQuery({ queryKey: ["admin", "assignments"], queryFn: () => adminAssignmentsApi.list() });

  const adjudicators = adjQ.data ?? [];
  const events = eventsQ.data ?? [];
  const assignments = asnQ.data ?? [];

  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const days = 30;
  const start = anchor;
  const end = addDays(start, days);

  const dayList = useMemo(
    () => Array.from({ length: days }, (_, i) => addDays(start, i)),
    [start]
  );

  type Bar = { event: AdminEvent; assignment: AdminAssignment; offsetDays: number; spanDays: number };

  const rows = useMemo(() => {
    return adjudicators.map((adj) => {
      const bars: Bar[] = assignments
        .filter((a) => a.adjudicator_id === adj.id && a.status !== "Cancelled")
        .map((a): Bar | null => {
          const ev = events.find((e) => e.id === a.event_id);
          if (!ev || !ev.start_iso || !ev.end_iso) return null;
          const evStart = startOfDay(new Date(ev.start_iso));
          const evEnd = startOfDay(new Date(ev.end_iso));
          const clipStart = evStart < start ? start : evStart;
          const clipEnd = evEnd > end ? addDays(end, -1) : evEnd;
          if (clipEnd < start || clipStart >= end) return null;
          const offsetDays = Math.round((clipStart.getTime() - start.getTime()) / DAY_MS);
          const spanDays = Math.max(1, Math.round((clipEnd.getTime() - clipStart.getTime()) / DAY_MS) + 1);
          return { event: ev, assignment: a, offsetDays, spanDays };
        })
        .filter((b): b is Bar => b !== null);
      return { adj, bars };
    });
  }, [adjudicators, assignments, events, start, end]);

  const rowsWithConflict = useMemo(() => {
    return rows.map((r) => {
      let hasConflict = false;
      for (let i = 0; i < r.bars.length; i++) {
        for (let j = i + 1; j < r.bars.length; j++) {
          const a = r.bars[i]; const b = r.bars[j];
          if (a.offsetDays <= b.offsetDays + b.spanDays - 1 && b.offsetDays <= a.offsetDays + a.spanDays - 1) {
            hasConflict = true; break;
          }
        }
        if (hasConflict) break;
      }
      return { ...r, hasConflict };
    });
  }, [rows]);

  const conflicts = rowsWithConflict.filter((r) => r.hasConflict).length;
  const colWidth = 36;

  if (adjQ.isLoading || eventsQ.isLoading || asnQ.isLoading) {
    return <Card className="py-16 flex items-center justify-center gap-2 text-muted mt-10 max-w-md mx-auto"><Loader2 className="h-4 w-4 animate-spin" /> Loading calendar…</Card>;
  }

  return (
    <>
      <PageHeader
        eyebrow="Admin · Calendar"
        title="Availability calendar"
        subtitle="30-day forward view of every adjudicator's scheduled events. Overlapping bars indicate scheduling conflicts."
        actions={
          <>
            <Button variant="ghost" onClick={() => setAnchor(addDays(anchor, -7))}><ChevronLeft className="h-4 w-4" /> 7 days</Button>
            <Button variant="ghost" onClick={() => setAnchor(startOfDay(new Date()))}>Today</Button>
            <Button variant="ghost" onClick={() => setAnchor(addDays(anchor, 7))}>7 days <ChevronRight className="h-4 w-4" /></Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Badge tone="default"><CalendarRange className="h-3 w-3" /> {formatDate(start)} → {formatDate(addDays(end, -1))}</Badge>
        {conflicts > 0 ? (
          <Badge tone="red"><AlertTriangle className="h-3 w-3" /> {conflicts} conflict{conflicts > 1 ? "s" : ""}</Badge>
        ) : (
          <Badge tone="green">No scheduling conflicts</Badge>
        )}
        <span className="text-[11px] text-muted">Hover any bar to see its event. Click to open assignments.</span>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ minWidth: 220 + colWidth * days + 24 }}>
            <div className="flex border-b border-line bg-canvas/60 sticky top-0 z-10">
              <div className="w-[160px] sm:w-[220px] shrink-0 px-4 py-2 text-[10px] uppercase tracking-wider text-muted font-semibold">Adjudicator</div>
              <div className="flex">
                {dayList.map((d, i) => {
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                  const isFirstOfMonth = d.getDate() === 1;
                  const isToday = d.toDateString() === new Date().toDateString();
                  return (
                    <div key={i} style={{ width: colWidth }} className={`shrink-0 border-l border-line text-center py-2 ${isWeekend ? "bg-canvas/40" : ""} ${isToday ? "bg-royal/[0.06]" : ""}`}>
                      <div className={`text-[9px] uppercase tracking-wider ${isToday ? "text-royal font-bold" : "text-muted"}`}>{d.toLocaleDateString("en-US", { weekday: "short" })[0]}</div>
                      <div className={`text-[11px] font-semibold ${isFirstOfMonth ? "text-royal" : "text-soft"}`}>{d.getDate()}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {rowsWithConflict.length === 0 && (
              <div className="px-4 py-12 text-center text-sm text-muted">No adjudicators on the roster yet.</div>
            )}

            {rowsWithConflict.map(({ adj, bars, hasConflict }) => (
              <div key={adj.id} className="flex border-b border-line hover:bg-canvas/30">
                <div className="w-[160px] sm:w-[220px] shrink-0 px-4 py-3 flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-royal/10 text-royal flex items-center justify-center text-[10px] font-bold shrink-0">{adj.initials}</div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-soft truncate">{adj.name}</div>
                    <div className="text-[10px] text-muted flex items-center gap-1.5">
                      {adj.region}
                      {hasConflict && <Badge tone="red"><AlertTriangle className="h-2.5 w-2.5" /> conflict</Badge>}
                      {adj.status === "On leave" && <Badge tone="amber">On leave</Badge>}
                    </div>
                  </div>
                </div>
                <div className="relative flex" style={{ height: 60 }}>
                  {dayList.map((d, i) => {
                    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                    const isToday = d.toDateString() === new Date().toDateString();
                    return <div key={i} style={{ width: colWidth }} className={`shrink-0 border-l border-line/60 ${isWeekend ? "bg-canvas/30" : ""} ${isToday ? "bg-royal/[0.04]" : ""}`} />;
                  })}
                  {bars.map((b, i) => {
                    const tone =
                      b.assignment.status === "On-site" ? "bg-emerald-500" :
                      b.assignment.status === "Travelling" ? "bg-gold" :
                      b.assignment.status === "Completed" ? "bg-slate-400" : "bg-royal";
                    return (
                      <Link key={i} to={`/admin/events/${b.event.id}`}
                        className={`absolute top-2 bottom-2 ${tone} rounded-md text-white text-[10px] px-2 flex items-center shadow hover:brightness-110 transition`}
                        style={{ left: b.offsetDays * colWidth + 2, width: Math.max(20, b.spanDays * colWidth - 4) }}
                        title={`${b.event.title} (${b.event.id}) · ${b.assignment.role}`}>
                        <span className="truncate">{b.event.id.split("-").slice(-1)[0]} · {b.event.city ?? ""}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 py-3 border-t border-line flex flex-wrap items-center gap-3 text-[11px] text-muted">
          <Legend color="bg-royal" label="Assigned" />
          <Legend color="bg-gold" label="Travelling" />
          <Legend color="bg-emerald-500" label="On-site" />
          <Legend color="bg-slate-400" label="Completed" />
        </div>
      </Card>
    </>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className={`inline-block h-2.5 w-4 rounded ${color}`} /> {label}</span>;
}
